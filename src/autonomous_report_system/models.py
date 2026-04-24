from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, HttpUrl, field_validator


class AgentRole(str, Enum):
    RESEARCHER = "Researcher"
    ANALYST = "Analyst"
    CRITIC = "Critic"
    WRITER = "Writer"
    EDITOR = "Editor"


class Source(BaseModel):
    id: int
    title: str
    url: HttpUrl | str
    content: str
    score: float = 0.0
    published_date: str | None = None
    provider: str = "tavily"

    @field_validator("content")
    @classmethod
    def normalize_content(cls, value: str) -> str:
        return " ".join(value.split())

    @property
    def citation_label(self) -> str:
        return f"[{self.id}]"


class Claim(BaseModel):
    text: str
    source_ids: list[int] = Field(default_factory=list)
    confidence: str = "medium"


class ResearchBrief(BaseModel):
    topic: str
    sources: list[Source]
    search_queries: list[str] = Field(default_factory=list)
    collected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class Analysis(BaseModel):
    key_findings: list[str] = Field(default_factory=list)
    patterns: list[str] = Field(default_factory=list)
    contradictions: list[str] = Field(default_factory=list)
    supported_claims: list[Claim] = Field(default_factory=list)


class Critique(BaseModel):
    unsupported_assertions: list[str] = Field(default_factory=list)
    fact_check_notes: list[str] = Field(default_factory=list)
    re_research_queries: list[str] = Field(default_factory=list)
    approved: bool = False


class ReportSection(BaseModel):
    heading: str
    body: str


class ReportDraft(BaseModel):
    title: str
    executive_summary: str
    sections: list[ReportSection]
    citations: list[Source]


class FinalReport(ReportDraft):
    topic: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    metadata: dict[str, Any] = Field(default_factory=dict)


class SessionRecord(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime
    message_count: int = 0
    last_message_preview: str | None = None


class MessageRecord(BaseModel):
    id: str
    session_id: str
    role: str
    content: str
    created_at: datetime
    job_id: str | None = None
    report_title: str | None = None
    report_markdown_path: str | None = None
    report_html_path: str | None = None
    report_pdf_path: str | None = None


class JobRecord(BaseModel):
    id: str
    session_id: str
    topic: str
    status: str
    created_at: datetime
    updated_at: datetime
    error: str | None = None
    assistant_message_id: str | None = None
    report_json: dict[str, Any] | None = None
