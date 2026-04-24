from __future__ import annotations

import shutil
from pathlib import Path
from uuid import uuid4

from autonomous_report_system.llm import PromptCache
from autonomous_report_system.storage import Storage


def make_temp_dir() -> Path:
    root = Path("test-temp")
    root.mkdir(exist_ok=True)
    path = root / uuid4().hex
    path.mkdir()
    return path


def test_prompt_cache_round_trip() -> None:
    temp_dir = make_temp_dir()
    try:
        cache = PromptCache(temp_dir / "cache.db")
        assert cache.get("gpt-test", "sys", "usr") is None
        cache.set("gpt-test", "sys", "usr", '{"ok": true}')
        assert cache.get("gpt-test", "sys", "usr") == '{"ok": true}'
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


def test_storage_session_message_job_lifecycle() -> None:
    temp_dir = make_temp_dir()
    try:
        storage = Storage(temp_dir / "app.db")
        session = storage.create_session("Testing")
        user_message = storage.create_message(session.id, "user", "Research quantum networking")
        job = storage.create_job(session.id, "Research quantum networking")
        storage.update_job(job.id, status="completed", assistant_message_id=user_message.id, report_json={"title": "Done"})

        listed_sessions = storage.list_sessions()
        listed_messages = storage.list_messages(session.id)
        loaded_job = storage.get_job(job.id)

        assert listed_sessions[0].title == "Testing"
        assert listed_messages[0].content == "Research quantum networking"
        assert loaded_job.status == "completed"
        assert loaded_job.report_json == {"title": "Done"}
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)
