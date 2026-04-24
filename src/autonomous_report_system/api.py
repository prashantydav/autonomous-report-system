from __future__ import annotations

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from autonomous_report_system.api_models import CreateSessionRequest, SendMessageRequest, SessionDetailResponse
from autonomous_report_system.config import Settings
from autonomous_report_system.models import JobRecord, SessionRecord
from autonomous_report_system.services import ReportJobService, SessionService
from autonomous_report_system.storage import Storage


def create_app(settings: Settings | None = None) -> FastAPI:
    app_settings = settings or Settings.from_env()
    storage = Storage(app_settings.database_path)
    session_service = SessionService(storage)
    job_service = ReportJobService(storage, app_settings)

    app = FastAPI(title="Autonomous Research & Report Generation System", version="2.0.0")
    app.state.settings = app_settings
    app.state.storage = storage
    app.state.session_service = session_service
    app.state.job_service = job_service

    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.cors_allow_origins,
        allow_credentials="*" not in app_settings.cors_allow_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/sessions", response_model=list[SessionRecord])
    def list_sessions() -> list[SessionRecord]:
        return session_service.list_sessions()

    @app.post("/sessions", response_model=SessionRecord)
    def create_session(request: CreateSessionRequest) -> SessionRecord:
        return session_service.create_session(title=request.title)

    @app.get("/sessions/{session_id}", response_model=SessionDetailResponse)
    def get_session(session_id: str) -> SessionDetailResponse:
        try:
            return SessionDetailResponse(
                session=session_service.get_session(session_id),
                messages=session_service.list_messages(session_id),
                jobs=storage.list_jobs_for_session(session_id),
            )
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Session not found") from exc

    @app.post("/sessions/{session_id}/messages", response_model=JobRecord)
    def send_message(session_id: str, request: SendMessageRequest) -> JobRecord:
        try:
            return job_service.submit(session_id, request.content)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Session not found") from exc

    @app.get("/jobs/{job_id}", response_model=JobRecord)
    def get_job(job_id: str) -> JobRecord:
        try:
            return job_service.get_job(job_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Job not found") from exc

    @app.get("/messages/{message_id}/artifacts/{artifact_kind}")
    def get_artifact(message_id: str, artifact_kind: str) -> FileResponse:
        try:
            message = storage.get_message(message_id)
        except KeyError as exc:
            raise HTTPException(status_code=404, detail="Message not found") from exc

        artifact_map = {
            "markdown": message.report_markdown_path,
            "html": message.report_html_path,
            "pdf": message.report_pdf_path,
        }
        path = artifact_map.get(artifact_kind)
        if not path:
            raise HTTPException(status_code=404, detail="Artifact not found")
        return FileResponse(path)

    return app
