from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv


@dataclass(frozen=True)
class Settings:
    openai_api_key: str | None
    tavily_api_key: str | None
    openai_model: str
    output_dir: Path
    database_path: Path
    prompt_cache_path: Path
    cors_allow_origins: list[str]
    max_sources: int
    max_search_workers: int
    max_job_workers: int

    @classmethod
    def from_env(cls) -> "Settings":
        load_dotenv()
        cors_raw = os.getenv("CORS_ALLOW_ORIGINS", "*")
        return cls(
            openai_api_key=os.getenv("OPENAI_API_KEY"),
            tavily_api_key=os.getenv("TAVILY_API_KEY"),
            openai_model=os.getenv("OPENAI_MODEL", "gpt-4.1-mini"),
            output_dir=Path(os.getenv("REPORT_OUTPUT_DIR", "reports")),
            database_path=Path(os.getenv("DATABASE_PATH", "data/app.db")),
            prompt_cache_path=Path(os.getenv("PROMPT_CACHE_PATH", "data/prompt_cache.db")),
            cors_allow_origins=[item.strip() for item in cors_raw.split(",") if item.strip()] or ["*"],
            max_sources=int(os.getenv("MAX_SOURCES", "24")),
            max_search_workers=int(os.getenv("MAX_SEARCH_WORKERS", "6")),
            max_job_workers=int(os.getenv("MAX_JOB_WORKERS", "4")),
        )
