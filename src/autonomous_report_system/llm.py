from __future__ import annotations

import json
import sqlite3
from collections import defaultdict
from datetime import datetime, timezone
from hashlib import sha256
from pathlib import Path
from threading import Lock
from typing import Any, Protocol


class PromptCacheBackend(Protocol):
    def get(self, model: str, system_prompt: str, user_prompt: str) -> str | None:
        ...

    def set(self, model: str, system_prompt: str, user_prompt: str, response_text: str) -> None:
        ...


class PromptCache:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, timeout=30)
        connection.row_factory = sqlite3.Row
        return connection

    def _init_db(self) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS prompt_cache (
                    cache_key TEXT PRIMARY KEY,
                    model TEXT NOT NULL,
                    system_prompt TEXT NOT NULL,
                    user_prompt TEXT NOT NULL,
                    response_text TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    hit_count INTEGER NOT NULL DEFAULT 0
                )
                """
            )
            connection.commit()

    @staticmethod
    def build_key(model: str, system_prompt: str, user_prompt: str) -> str:
        return build_prompt_cache_key(model, system_prompt, user_prompt)

    def get(self, model: str, system_prompt: str, user_prompt: str) -> str | None:
        cache_key = self.build_key(model, system_prompt, user_prompt)
        with self._connect() as connection:
            row = connection.execute(
                "SELECT response_text, hit_count FROM prompt_cache WHERE cache_key = ?",
                (cache_key,),
            ).fetchone()
            if row is None:
                return None
            connection.execute(
                "UPDATE prompt_cache SET hit_count = ? WHERE cache_key = ?",
                (int(row["hit_count"]) + 1, cache_key),
            )
            connection.commit()
            return str(row["response_text"])

    def set(self, model: str, system_prompt: str, user_prompt: str, response_text: str) -> None:
        cache_key = self.build_key(model, system_prompt, user_prompt)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT OR REPLACE INTO prompt_cache (
                    cache_key, model, system_prompt, user_prompt, response_text, created_at, hit_count
                ) VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT hit_count FROM prompt_cache WHERE cache_key = ?), 0))
                """,
                (
                    cache_key,
                    model,
                    system_prompt,
                    user_prompt,
                    response_text,
                    datetime.now(timezone.utc).isoformat(),
                    cache_key,
                ),
            )
            connection.commit()


class RedisPromptCache:
    def __init__(self, redis_url: str, ttl_seconds: int | None = None, namespace: str = "prompt-cache") -> None:
        from redis import Redis

        self.client = Redis.from_url(redis_url, decode_responses=True)
        self.ttl_seconds = ttl_seconds
        self.namespace = namespace

    def _key(self, model: str, system_prompt: str, user_prompt: str) -> str:
        return f"{self.namespace}:{build_prompt_cache_key(model, system_prompt, user_prompt)}"

    def get(self, model: str, system_prompt: str, user_prompt: str) -> str | None:
        cache_key = self._key(model, system_prompt, user_prompt)
        value = self.client.get(cache_key)
        if value is not None:
            self.client.hincrby(f"{cache_key}:meta", "hit_count", 1)
        return value

    def set(self, model: str, system_prompt: str, user_prompt: str, response_text: str) -> None:
        cache_key = self._key(model, system_prompt, user_prompt)
        if self.ttl_seconds:
            self.client.setex(cache_key, self.ttl_seconds, response_text)
            self.client.hset(
                f"{cache_key}:meta",
                mapping={"model": model, "created_at": datetime.now(timezone.utc).isoformat()},
            )
            self.client.expire(f"{cache_key}:meta", self.ttl_seconds)
        else:
            self.client.set(cache_key, response_text)
            self.client.hset(
                f"{cache_key}:meta",
                mapping={"model": model, "created_at": datetime.now(timezone.utc).isoformat()},
            )


class CompositePromptCache:
    def __init__(self, primary: PromptCacheBackend, fallback: PromptCacheBackend | None = None) -> None:
        self.primary = primary
        self.fallback = fallback

    def get(self, model: str, system_prompt: str, user_prompt: str) -> str | None:
        try:
            cached = self.primary.get(model, system_prompt, user_prompt)
        except Exception:
            cached = None
        if cached is not None:
            return cached
        if self.fallback is None:
            return None
        cached = self.fallback.get(model, system_prompt, user_prompt)
        if cached is not None:
            try:
                self.primary.set(model, system_prompt, user_prompt, cached)
            except Exception:
                pass
        return cached

    def set(self, model: str, system_prompt: str, user_prompt: str, response_text: str) -> None:
        try:
            self.primary.set(model, system_prompt, user_prompt, response_text)
        except Exception:
            pass
        if self.fallback is not None:
            self.fallback.set(model, system_prompt, user_prompt, response_text)


def build_prompt_cache_key(model: str, system_prompt: str, user_prompt: str) -> str:
    digest = sha256()
    digest.update(model.encode("utf-8"))
    digest.update(b"\x00")
    digest.update(system_prompt.encode("utf-8"))
    digest.update(b"\x00")
    digest.update(user_prompt.encode("utf-8"))
    return digest.hexdigest()


class LLMClient:
    def __init__(self, model: str, temperature: float = 0.2, prompt_cache: PromptCacheBackend | None = None) -> None:
        from langchain_openai import ChatOpenAI

        self.model_name = model
        self.model = ChatOpenAI(model=model, temperature=temperature)
        self.prompt_cache = prompt_cache
        self._cache_locks: defaultdict[str, Lock] = defaultdict(Lock)

    def invoke_text(self, system_prompt: str, user_prompt: str) -> str:
        if self.prompt_cache is not None:
            cached = self.prompt_cache.get(self.model_name, system_prompt, user_prompt)
            if cached is not None:
                return cached

        lock_key = build_prompt_cache_key(self.model_name, system_prompt, user_prompt)
        with self._cache_locks[lock_key]:
            if self.prompt_cache is not None:
                cached = self.prompt_cache.get(self.model_name, system_prompt, user_prompt)
                if cached is not None:
                    return cached

            response = self.model.invoke(
                [
                    ("system", system_prompt),
                    ("user", user_prompt),
                ]
            )
            response_text = str(response.content)
            if self.prompt_cache is not None:
                self.prompt_cache.set(self.model_name, system_prompt, user_prompt, response_text)
            return response_text

    def invoke_json(self, system_prompt: str, user_prompt: str) -> dict[str, Any]:
        response = self.invoke_text(
            system_prompt + "\nReturn only valid JSON. Do not wrap it in markdown.",
            user_prompt,
        )
        return parse_json_object(response)


def parse_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    try:
        value = json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        value = json.loads(cleaned[start : end + 1])

    if not isinstance(value, dict):
        raise ValueError("Expected a JSON object from LLM response.")
    return value
