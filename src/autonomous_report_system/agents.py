from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Any

from autonomous_report_system.llm import LLMClient
from autonomous_report_system.models import Analysis, Claim, Critique, ReportDraft, ReportSection, ResearchBrief
from autonomous_report_system.research import TavilyResearchClient, dedupe_sources, run_parallel_searches, source_digest


CREWAI_AGENT_ROLES = ["Researcher", "Analyst", "Critic", "Writer", "Editor"]


def build_crewai_agents() -> list[Any]:
    try:
        from crewai import Agent
    except Exception:  # pragma: no cover - CrewAI can be absent in unit tests.
        return []
    return [
        Agent(role="Researcher", goal="Find diverse, high-quality sources for a topic.", backstory="Expert web researcher."),
        Agent(role="Analyst", goal="Synthesize source evidence into patterns and contradictions.", backstory="Strategic research analyst."),
        Agent(role="Critic", goal="Fact-check claims and flag weak evidence.", backstory="Skeptical editorial reviewer."),
        Agent(role="Writer", goal="Draft a structured professional report with citations.", backstory="Enterprise research writer."),
        Agent(role="Editor", goal="Improve clarity, consistency, and executive tone.", backstory="Senior report editor."),
    ]


class ResearcherAgent:
    def __init__(self, tavily: TavilyResearchClient, llm: LLMClient, max_sources: int, max_search_workers: int = 6) -> None:
        self.tavily = tavily
        self.llm = llm
        self.max_sources = max_sources
        self.max_search_workers = max_search_workers

    def run(self, topic: str) -> ResearchBrief:
        query_payload = self.llm.invoke_json(
            "You are a research planner. Generate broad, diverse web search queries for a professional report.",
            (
                "Create 6 search queries for this topic. Include market, technical, risk, recent developments, "
                f"contrarian, and data-oriented angles.\nTopic: {topic}\n"
                'JSON schema: {"queries": ["..."]}'
            ),
        )
        queries = [str(q) for q in query_payload.get("queries", []) if str(q).strip()]
        if not queries:
            queries = [topic]

        per_query = max(4, self.max_sources // max(len(queries), 1) + 2)
        raw_results = run_parallel_searches(
            client=self.tavily,
            queries=queries,
            max_results=per_query,
            max_workers=self.max_search_workers,
        )

        return ResearchBrief(topic=topic, sources=dedupe_sources(raw_results, self.max_sources), search_queries=queries)


class AnalystAgent:
    def __init__(self, llm: LLMClient) -> None:
        self.llm = llm

    def run(self, brief: ResearchBrief) -> Analysis:
        payload = self.llm.invoke_json(
            "You are an analyst. Synthesize evidence, compare sources, and surface contradictions.",
            (
                f"Topic: {brief.topic}\nSources:\n{source_digest(brief.sources)}\n\n"
                "Return JSON with key_findings, patterns, contradictions, and supported_claims. "
                "Every supported claim must cite source_ids.\n"
                '{"key_findings":["..."],"patterns":["..."],"contradictions":["..."],'
                '"supported_claims":[{"text":"...","source_ids":[1,2],"confidence":"high|medium|low"}]}'
            ),
        )
        claims = [Claim(**claim) for claim in payload.get("supported_claims", []) if isinstance(claim, dict)]
        return Analysis(
            key_findings=[str(x) for x in payload.get("key_findings", [])],
            patterns=[str(x) for x in payload.get("patterns", [])],
            contradictions=[str(x) for x in payload.get("contradictions", [])],
            supported_claims=claims,
        )


class CriticAgent:
    def __init__(self, llm: LLMClient) -> None:
        self.llm = llm

    def run(self, brief: ResearchBrief, analysis: Analysis) -> Critique:
        payload = self.llm.invoke_json(
            "You are a critic and fact-checker. Be strict about source support and citation quality.",
            (
                f"Topic: {brief.topic}\nSources:\n{source_digest(brief.sources, 900)}\n\n"
                f"Analysis JSON:\n{analysis.model_dump_json()}\n\n"
                "Return JSON identifying unsupported assertions, fact_check_notes, re_research_queries, and approved boolean. "
                "Approve only if the evidence can support a professional report.\n"
                '{"unsupported_assertions":["..."],"fact_check_notes":["..."],"re_research_queries":["..."],"approved":true}'
            ),
        )
        return Critique.model_validate(payload)


class WriterAgent:
    def __init__(self, llm: LLMClient, max_workers: int = 4) -> None:
        self.llm = llm
        self.max_workers = max(1, max_workers)

    def run(self, brief: ResearchBrief, analysis: Analysis, critique: Critique) -> ReportDraft:
        outline_payload = self.llm.invoke_json(
            "You are a senior research writer. Plan a professional report before drafting it.",
            (
                f"Topic: {brief.topic}\n"
                f"Analysis:\n{analysis.model_dump_json()}\n"
                f"Critique:\n{critique.model_dump_json(by_alias=True)}\n"
                "Create a compact report outline with 5-7 sections. Include section briefs that identify the evidence, "
                "risks, recommendations, and conclusion coverage needed. Do not draft full sections yet.\n"
                '{"title":"...","executive_summary":"...","sections":[{"heading":"...","brief":"..."}]}'
            ),
        )
        outline_sections = [section for section in outline_payload.get("sections", []) if isinstance(section, dict)]
        if not outline_sections:
            outline_sections = [
                {"heading": "Findings", "brief": "Summarize the most important evidence-backed findings."},
                {"heading": "Risks", "brief": "Explain major risks and uncertainties."},
                {"heading": "Recommendations", "brief": "Give practical recommendations grounded in the evidence."},
                {"heading": "Conclusion", "brief": "Conclude the report with the strongest supported implications."},
            ]

        def draft_section(index: int, section: dict[str, Any]) -> tuple[int, ReportSection]:
            heading = str(section.get("heading") or f"Section {index + 1}")
            section_brief = str(section.get("brief") or "")
            payload = self.llm.invoke_json(
                "You are a senior research writer. Draft one report section with citation markers.",
                (
                    f"Topic: {brief.topic}\n"
                    f"Section heading: {heading}\n"
                    f"Section brief: {section_brief}\n"
                    f"Analysis:\n{analysis.model_dump_json()}\n"
                    f"Critique:\n{critique.model_dump_json(by_alias=True)}\n"
                    f"Sources:\n{source_digest(brief.sources, 1000)}\n\n"
                    "Draft only this section. Use concise professional prose and inline citation markers like [1]. "
                    "Do not introduce facts that are not supported by the provided sources.\n"
                    '{"heading":"...","body":"..."}'
                ),
            )
            return index, ReportSection(heading=str(payload.get("heading") or heading), body=str(payload.get("body") or ""))

        sections: list[ReportSection | None] = [None] * len(outline_sections)
        with ThreadPoolExecutor(max_workers=min(self.max_workers, len(outline_sections))) as executor:
            futures = [executor.submit(draft_section, index, section) for index, section in enumerate(outline_sections)]
            for future in as_completed(futures):
                index, section = future.result()
                sections[index] = section

        return ReportDraft(
            title=str(outline_payload.get("title") or brief.topic),
            executive_summary=str(outline_payload.get("executive_summary") or ""),
            sections=[section for section in sections if section is not None],
            citations=brief.sources,
        )


class EditorAgent:
    def __init__(self, llm: LLMClient) -> None:
        self.llm = llm

    def run(self, draft: ReportDraft) -> ReportDraft:
        payload = self.llm.invoke_json(
            "You are an executive editor. Improve clarity, remove redundancy, keep citations intact, and preserve meaning.",
            (
                "Edit this report JSON. Maintain the same structure and all source citation markers. "
                "Use a polished, professional tone.\n"
                f"{json.dumps(draft.model_dump(mode='json'), ensure_ascii=True)}\n"
                '{"title":"...","executive_summary":"...","sections":[{"heading":"...","body":"..."}]}'
            ),
        )
        return ReportDraft(
            title=str(payload.get("title") or draft.title),
            executive_summary=str(payload.get("executive_summary") or draft.executive_summary),
            sections=[ReportSection(**section) for section in payload.get("sections", []) if isinstance(section, dict)],
            citations=draft.citations,
        )
