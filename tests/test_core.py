from __future__ import annotations

from datetime import datetime, timezone

from autonomous_report_system.llm import parse_json_object
from autonomous_report_system.models import FinalReport, ReportSection, Source
from autonomous_report_system.render import report_to_markdown, slugify
from autonomous_report_system.research import dedupe_sources


def test_parse_json_object_strips_markdown_fence() -> None:
    assert parse_json_object('```json\n{"answer": 42}\n```') == {"answer": 42}


def test_dedupe_sources_assigns_stable_ids() -> None:
    raw = [
        {"title": "A", "url": "https://example.com/a", "content": "First source", "score": 0.9},
        {"title": "A copy", "url": "https://example.com/a", "content": "Duplicate", "score": 0.8},
        {"title": "B", "url": "https://example.com/b", "raw_content": "Second source", "score": 0.7},
    ]

    sources = dedupe_sources(raw, limit=10)

    assert [source.id for source in sources] == [1, 2]
    assert [str(source.url) for source in sources] == ["https://example.com/a", "https://example.com/b"]


def test_markdown_includes_citations() -> None:
    report = FinalReport(
        topic="AI governance",
        title="AI Governance Report",
        executive_summary="Summary [1].",
        sections=[ReportSection(heading="Findings", body="Finding [1].")],
        citations=[Source(id=1, title="Source", url="https://example.com", content="Evidence")],
        generated_at=datetime(2026, 1, 1, tzinfo=timezone.utc),
    )

    markdown = report_to_markdown(report)

    assert "# AI Governance Report" in markdown
    assert "[1] Source. https://example.com" in markdown


def test_slugify_has_safe_fallback() -> None:
    assert slugify("AI: Risk & Governance!") == "ai-risk-governance"
    assert slugify("!!!") == "report"
