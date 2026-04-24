from __future__ import annotations

import html
import re
from pathlib import Path

from autonomous_report_system.models import FinalReport


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return slug[:70] or "report"


def report_to_markdown(report: FinalReport) -> str:
    lines = [
        f"# {report.title}",
        "",
        f"Generated: {report.generated_at.date().isoformat()}",
        "",
        "## Executive Summary",
        "",
        report.executive_summary,
        "",
    ]
    for section in report.sections:
        lines.extend([f"## {section.heading}", "", section.body, ""])

    lines.extend(["## Sources", ""])
    for source in report.citations:
        lines.append(f"{source.citation_label} {source.title}. {source.url}")
    lines.append("")
    return "\n".join(lines)


def report_to_html(report: FinalReport) -> str:
    section_html = "\n".join(
        f"<section><h2>{html.escape(section.heading)}</h2>{paragraphs(section.body)}</section>"
        for section in report.sections
    )
    source_html = "\n".join(
        f"<li id='source-{source.id}'><strong>[{source.id}] {html.escape(source.title)}</strong><br>"
        f"<a href='{html.escape(str(source.url))}'>{html.escape(str(source.url))}</a></li>"
        for source in report.citations
    )
    return f"""<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>{html.escape(report.title)}</title>
  <style>
    @page {{ size: Letter; margin: 0.75in; }}
    body {{ font-family: Arial, sans-serif; color: #202124; line-height: 1.48; font-size: 10.5pt; }}
    h1 {{ font-size: 24pt; margin: 0 0 12pt; }}
    h2 {{ font-size: 15pt; margin: 18pt 0 7pt; border-bottom: 1px solid #d0d7de; padding-bottom: 3pt; }}
    p {{ margin: 0 0 8pt; }}
    .meta {{ color: #59636e; margin-bottom: 18pt; }}
    .summary {{ background: #f6f8fa; border-left: 4px solid #2f6f9f; padding: 12pt; margin-bottom: 16pt; }}
    li {{ margin-bottom: 8pt; overflow-wrap: anywhere; }}
    a {{ color: #1f5f99; text-decoration: none; }}
  </style>
</head>
<body>
  <h1>{html.escape(report.title)}</h1>
  <p class="meta">Generated {report.generated_at.date().isoformat()} | {report.metadata.get("source_count", len(report.citations))} sources analyzed</p>
  <h2>Executive Summary</h2>
  <div class="summary">{paragraphs(report.executive_summary)}</div>
  {section_html}
  <h2>Sources</h2>
  <ol>{source_html}</ol>
</body>
</html>"""


def paragraphs(text: str) -> str:
    parts = [part.strip() for part in text.split("\n") if part.strip()]
    return "\n".join(f"<p>{html.escape(part)}</p>" for part in parts)


def write_report_files(report: FinalReport, output_dir: Path) -> tuple[Path, Path, Path | None]:
    output_dir.mkdir(parents=True, exist_ok=True)
    base = slugify(report.topic)
    markdown_path = output_dir / f"{base}.md"
    html_path = output_dir / f"{base}.html"
    pdf_path = output_dir / f"{base}.pdf"

    markdown_path.write_text(report_to_markdown(report), encoding="utf-8")
    html_path.write_text(report_to_html(report), encoding="utf-8")
    try:
        from weasyprint import HTML

        HTML(filename=str(html_path)).write_pdf(str(pdf_path))
    except OSError as exc:
        message = str(exc)
        if "libgobject" not in message and "cannot load library" not in message:
            raise
        return markdown_path, html_path, None

    return markdown_path, html_path, pdf_path
