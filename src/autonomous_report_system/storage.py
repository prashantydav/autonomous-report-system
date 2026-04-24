from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from autonomous_report_system.models import JobRecord, MessageRecord, SessionRecord


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class Storage:
    def __init__(self, db_path: Path) -> None:
        self.db_path = db_path
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self.db_path, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA journal_mode=WAL")
        return connection

    def _init_db(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS sessions (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    role TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    job_id TEXT,
                    report_title TEXT,
                    report_markdown_path TEXT,
                    report_html_path TEXT,
                    report_pdf_path TEXT,
                    FOREIGN KEY(session_id) REFERENCES sessions(id)
                );
                CREATE TABLE IF NOT EXISTS jobs (
                    id TEXT PRIMARY KEY,
                    session_id TEXT NOT NULL,
                    topic TEXT NOT NULL,
                    status TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    error TEXT,
                    assistant_message_id TEXT,
                    report_json TEXT,
                    FOREIGN KEY(session_id) REFERENCES sessions(id)
                );
                """
            )
            connection.commit()

    def create_session(self, title: str = "New Research") -> SessionRecord:
        session_id = uuid4().hex
        now = utc_now_iso()
        with self._connect() as connection:
            connection.execute(
                "INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)",
                (session_id, title, now, now),
            )
            connection.commit()
        return self.get_session(session_id)

    def get_session(self, session_id: str) -> SessionRecord:
        with self._connect() as connection:
            row = connection.execute(
                """
                SELECT s.*,
                       COUNT(m.id) AS message_count,
                       (
                           SELECT substr(content, 1, 140)
                           FROM messages
                           WHERE session_id = s.id
                           ORDER BY created_at DESC
                           LIMIT 1
                       ) AS last_message_preview
                FROM sessions s
                LEFT JOIN messages m ON m.session_id = s.id
                WHERE s.id = ?
                GROUP BY s.id
                """,
                (session_id,),
            ).fetchone()
            if row is None:
                raise KeyError(session_id)
            return SessionRecord.model_validate(dict(row))

    def list_sessions(self) -> list[SessionRecord]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT s.*,
                       COUNT(m.id) AS message_count,
                       (
                           SELECT substr(content, 1, 140)
                           FROM messages
                           WHERE session_id = s.id
                           ORDER BY created_at DESC
                           LIMIT 1
                       ) AS last_message_preview
                FROM sessions s
                LEFT JOIN messages m ON m.session_id = s.id
                GROUP BY s.id
                ORDER BY s.updated_at DESC
                """
            ).fetchall()
            return [SessionRecord.model_validate(dict(row)) for row in rows]

    def update_session_title(self, session_id: str, title: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?",
                (title, utc_now_iso(), session_id),
            )
            connection.commit()

    def touch_session(self, session_id: str) -> None:
        with self._connect() as connection:
            connection.execute(
                "UPDATE sessions SET updated_at = ? WHERE id = ?",
                (utc_now_iso(), session_id),
            )
            connection.commit()

    def create_message(
        self,
        session_id: str,
        role: str,
        content: str,
        job_id: str | None = None,
        report_title: str | None = None,
        report_markdown_path: str | None = None,
        report_html_path: str | None = None,
        report_pdf_path: str | None = None,
    ) -> MessageRecord:
        message_id = uuid4().hex
        now = utc_now_iso()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO messages (
                    id, session_id, role, content, created_at, job_id, report_title,
                    report_markdown_path, report_html_path, report_pdf_path
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    message_id,
                    session_id,
                    role,
                    content,
                    now,
                    job_id,
                    report_title,
                    report_markdown_path,
                    report_html_path,
                    report_pdf_path,
                ),
            )
            connection.execute(
                "UPDATE sessions SET updated_at = ? WHERE id = ?",
                (now, session_id),
            )
            connection.commit()
        return self.get_message(message_id)

    def get_message(self, message_id: str) -> MessageRecord:
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM messages WHERE id = ?", (message_id,)).fetchone()
            if row is None:
                raise KeyError(message_id)
            return MessageRecord.model_validate(dict(row))

    def list_messages(self, session_id: str) -> list[MessageRecord]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC",
                (session_id,),
            ).fetchall()
            return [MessageRecord.model_validate(dict(row)) for row in rows]

    def create_job(self, session_id: str, topic: str) -> JobRecord:
        job_id = uuid4().hex
        now = utc_now_iso()
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO jobs (id, session_id, topic, status, created_at, updated_at, error, assistant_message_id, report_json)
                VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, NULL)
                """,
                (job_id, session_id, topic, "queued", now, now),
            )
            connection.commit()
        return self.get_job(job_id)

    def update_job(
        self,
        job_id: str,
        *,
        status: str | None = None,
        error: str | None = None,
        assistant_message_id: str | None = None,
        report_json: dict | None = None,
    ) -> JobRecord:
        with self._connect() as connection:
            current = connection.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
            if current is None:
                raise KeyError(job_id)
            connection.execute(
                """
                UPDATE jobs
                SET status = ?, updated_at = ?, error = ?, assistant_message_id = ?, report_json = ?
                WHERE id = ?
                """,
                (
                    status if status is not None else current["status"],
                    utc_now_iso(),
                    error if error is not None else current["error"],
                    assistant_message_id if assistant_message_id is not None else current["assistant_message_id"],
                    json.dumps(report_json) if report_json is not None else current["report_json"],
                    job_id,
                ),
            )
            connection.commit()
        return self.get_job(job_id)

    def get_job(self, job_id: str) -> JobRecord:
        with self._connect() as connection:
            row = connection.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
            if row is None:
                raise KeyError(job_id)
            payload = dict(row)
            if payload["report_json"]:
                payload["report_json"] = json.loads(payload["report_json"])
            return JobRecord.model_validate(payload)

    def list_jobs_for_session(self, session_id: str) -> list[JobRecord]:
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT * FROM jobs WHERE session_id = ? ORDER BY created_at DESC",
                (session_id,),
            ).fetchall()
            result: list[JobRecord] = []
            for row in rows:
                payload = dict(row)
                if payload["report_json"]:
                    payload["report_json"] = json.loads(payload["report_json"])
                result.append(JobRecord.model_validate(payload))
            return result
