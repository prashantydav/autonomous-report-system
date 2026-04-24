from __future__ import annotations

from collections.abc import Iterable
from concurrent.futures import ThreadPoolExecutor, as_completed

from autonomous_report_system.models import Source


class TavilyResearchClient:
    def __init__(self, api_key: str) -> None:
        from tavily import TavilyClient

        self.client = TavilyClient(api_key=api_key)

    def search(self, query: str, max_results: int = 8) -> list[dict[str, object]]:
        response = self.client.search(
            query=query,
            search_depth="advanced",
            max_results=max_results,
            include_answer=False,
            include_raw_content=True,
        )
        results = response.get("results", [])
        return list(results) if isinstance(results, list) else []


def dedupe_sources(raw_results: Iterable[dict[str, object]], limit: int) -> list[Source]:
    seen_urls: set[str] = set()
    sources: list[Source] = []

    for item in raw_results:
        url = str(item.get("url") or "").strip()
        content = str(item.get("raw_content") or item.get("content") or "").strip()
        title = str(item.get("title") or url).strip()
        if not url or not content or url in seen_urls:
            continue
        seen_urls.add(url)
        sources.append(
            Source(
                id=len(sources) + 1,
                title=title[:220],
                url=url,
                content=content[:8000],
                score=float(item.get("score") or 0.0),
                published_date=str(item.get("published_date")) if item.get("published_date") else None,
            )
        )
        if len(sources) >= limit:
            break

    return sources


def source_digest(sources: list[Source], chars_per_source: int = 1400) -> str:
    chunks: list[str] = []
    for source in sources:
        chunks.append(
            f"{source.citation_label} {source.title}\nURL: {source.url}\n"
            f"Published: {source.published_date or 'unknown'}\n"
            f"Excerpt: {source.content[:chars_per_source]}"
        )
    return "\n\n".join(chunks)


def run_parallel_searches(
    client: TavilyResearchClient,
    queries: list[str],
    max_results: int,
    max_workers: int,
) -> list[dict[str, object]]:
    if not queries:
        return []

    results: list[dict[str, object]] = []
    with ThreadPoolExecutor(max_workers=max(1, min(max_workers, len(queries)))) as executor:
        futures = [executor.submit(client.search, query, max_results) for query in queries]
        for future in as_completed(futures):
            results.extend(future.result())
    return results
