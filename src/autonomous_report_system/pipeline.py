from __future__ import annotations

from autonomous_report_system.agents import (
    CREWAI_AGENT_ROLES,
    AnalystAgent,
    CriticAgent,
    EditorAgent,
    ResearcherAgent,
    WriterAgent,
)
from autonomous_report_system.config import Settings
from autonomous_report_system.llm import CompositePromptCache, LLMClient, PromptCache, PromptCacheBackend, RedisPromptCache
from autonomous_report_system.models import FinalReport
from autonomous_report_system.research import TavilyResearchClient, dedupe_sources, run_parallel_searches


def build_prompt_cache(settings: Settings) -> PromptCacheBackend | None:
    if settings.prompt_cache_backend == "none":
        return None
    sqlite_cache = PromptCache(settings.prompt_cache_path)
    if settings.prompt_cache_backend == "sqlite":
        return sqlite_cache
    if settings.redis_url and settings.prompt_cache_backend in {"auto", "redis"}:
        redis_cache = RedisPromptCache(settings.redis_url, ttl_seconds=settings.prompt_cache_ttl_seconds)
        return CompositePromptCache(redis_cache, fallback=sqlite_cache)
    return sqlite_cache


class ReportPipeline:
    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or Settings.from_env()
        if not self.settings.openai_api_key:
            raise RuntimeError("Missing OPENAI_API_KEY")
        if not self.settings.tavily_api_key:
            raise RuntimeError("Missing TAVILY_API_KEY")

        self.llm = LLMClient(
            model=self.settings.openai_model,
            prompt_cache=build_prompt_cache(self.settings),
        )
        self.tavily = TavilyResearchClient(api_key=self.settings.tavily_api_key)
        self.crewai_agent_roles = CREWAI_AGENT_ROLES

    def run(self, topic: str) -> FinalReport:
        researcher = ResearcherAgent(
            self.tavily,
            self.llm,
            self.settings.max_sources,
            max_search_workers=self.settings.max_search_workers,
        )
        analyst = AnalystAgent(self.llm)
        critic = CriticAgent(self.llm)
        writer = WriterAgent(self.llm, max_workers=self.settings.max_llm_workers)
        editor = EditorAgent(self.llm)

        brief = researcher.run(topic)
        if len(brief.sources) < 20:
            extra_results = self.tavily.search(f"{topic} evidence data sources reports", max_results=20)
            brief.sources = dedupe_sources([*(source.model_dump() for source in brief.sources), *extra_results], self.settings.max_sources)

        analysis = analyst.run(brief)
        critique = critic.run(brief, analysis)
        if not critique.approved and critique.re_research_queries:
            raw_results = run_parallel_searches(
                client=self.tavily,
                queries=critique.re_research_queries[:3],
                max_results=6,
                max_workers=self.settings.max_search_workers,
            )
            brief.sources = dedupe_sources([*(source.model_dump() for source in brief.sources), *raw_results], self.settings.max_sources)
            analysis = analyst.run(brief)
            critique = critic.run(brief, analysis)

        draft = writer.run(brief, analysis, critique)
        edited = editor.run(draft)
        return FinalReport(
            topic=topic,
            title=edited.title,
            executive_summary=edited.executive_summary,
            sections=edited.sections,
            citations=edited.citations,
            metadata={
                "source_count": len(brief.sources),
                "search_queries": brief.search_queries,
                "crewai_agent_roles": self.crewai_agent_roles,
                "critic_approved": critique.approved,
            },
        )
