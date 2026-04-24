from __future__ import annotations

import traceback
from concurrent.futures import ThreadPoolExecutor

from autonomous_report_system.config import Settings
from autonomous_report_system.models import FinalReport, JobRecord, MessageRecord, SessionRecord
from autonomous_report_system.pipeline import ReportPipeline
from autonomous_report_system.render import report_to_markdown, write_report_files
from autonomous_report_system.storage import Storage


class SessionService:
    def __init__(self, storage: Storage) -> None:
        self.storage = storage

    def create_session(self, title: str = "New Research") -> SessionRecord:
        return self.storage.create_session(title=title)

    def list_sessions(self) -> list[SessionRecord]:
        return self.storage.list_sessions()

    def get_session(self, session_id: str) -> SessionRecord:
        return self.storage.get_session(session_id)

    def list_messages(self, session_id: str) -> list[MessageRecord]:
        return self.storage.list_messages(session_id)


class ReportJobService:
    def __init__(self, storage: Storage, settings: Settings) -> None:
        self.storage = storage
        self.settings = settings
        self.executor = ThreadPoolExecutor(max_workers=settings.max_job_workers, thread_name_prefix="report-job")

    def submit(self, session_id: str, topic: str) -> JobRecord:
        self.storage.get_session(session_id)
        self.storage.create_message(session_id=session_id, role="user", content=topic)
        job = self.storage.create_job(session_id=session_id, topic=topic)
        self.executor.submit(self._run_job, job.id)
        if self.storage.get_session(session_id).title == "New Research":
            self.storage.update_session_title(session_id, topic[:80])
        return job

    def get_job(self, job_id: str) -> JobRecord:
        return self.storage.get_job(job_id)

    def _run_job(self, job_id: str) -> None:
        job = self.storage.update_job(job_id, status="running")
        try:
            pipeline = ReportPipeline(settings=self.settings)
            report = pipeline.run(job.topic)
            markdown_path, html_path, pdf_path = write_report_files(report, self.settings.output_dir)
            assistant_message = self.storage.create_message(
                session_id=job.session_id,
                role="assistant",
                content=report_to_markdown(report),
                job_id=job.id,
                report_title=report.title,
                report_markdown_path=str(markdown_path),
                report_html_path=str(html_path),
                report_pdf_path=str(pdf_path) if pdf_path else None,
            )
            self.storage.update_job(
                job.id,
                status="completed",
                assistant_message_id=assistant_message.id,
                report_json=report.model_dump(mode="json"),
            )
        except Exception as exc:  # pragma: no cover - exercised with live integrations.
            self.storage.create_message(
                session_id=job.session_id,
                role="assistant",
                content=(
                    "The research job failed.\n\n"
                    f"Error: {type(exc).__name__}: {exc}\n\n"
                    f"Trace:\n{traceback.format_exc(limit=3)}"
                ),
                job_id=job.id,
            )
            self.storage.update_job(job.id, status="failed", error=f"{type(exc).__name__}: {exc}")
