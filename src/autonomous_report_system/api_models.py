from __future__ import annotations

from pydantic import BaseModel, Field

from autonomous_report_system.models import JobRecord, MessageRecord, SessionRecord


class CreateSessionRequest(BaseModel):
    title: str = "New Research"


class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=3)


class SessionDetailResponse(BaseModel):
    session: SessionRecord
    messages: list[MessageRecord]
    jobs: list[JobRecord]
