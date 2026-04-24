from __future__ import annotations

import argparse
import sys
from dataclasses import replace
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC_PATH = ROOT / "src"
if str(SRC_PATH) not in sys.path:
    sys.path.insert(0, str(SRC_PATH))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Generate a professional research report with a five-agent crew.")
    parser.add_argument("topic", nargs="?", help="Research topic or question")
    parser.add_argument("--output-dir", default=None, help="Directory for markdown, HTML, and PDF outputs")
    parser.add_argument("--model", default=None, help="OpenAI model override")
    parser.add_argument("--max-sources", type=int, default=None, help="Target number of sources, default 24")
    parser.add_argument("--serve", action="store_true", help="Run the FastAPI service instead of a one-shot CLI report")
    parser.add_argument("--host", default="0.0.0.0", help="FastAPI host")
    parser.add_argument("--port", type=int, default=8000, help="FastAPI port")
    return parser.parse_args()


def main() -> None:
    from autonomous_report_system.config import Settings

    args = parse_args()
    settings = Settings.from_env()
    if args.output_dir or args.model or args.max_sources:
        settings = replace(
            settings,
            openai_model=args.model or settings.openai_model,
            output_dir=Path(args.output_dir) if args.output_dir else settings.output_dir,
            max_sources=args.max_sources or settings.max_sources,
        )

    if args.serve:
        import uvicorn

        uvicorn.run("app:app", host=args.host, port=args.port, reload=False)
        return

    if not args.topic:
        raise SystemExit("A topic is required unless --serve is used.")

    from autonomous_report_system.pipeline import ReportPipeline
    from autonomous_report_system.render import write_report_files

    pipeline = ReportPipeline(settings=settings)
    report = pipeline.run(args.topic)
    md_path, html_path, pdf_path = write_report_files(report, settings.output_dir)

    print(f"Report generated:\n- Markdown: {md_path}\n- HTML: {html_path}")
    if pdf_path:
        print(f"- PDF: {pdf_path}")
    else:
        print(
            "- PDF: skipped because WeasyPrint could not load its native GTK/Pango libraries. "
            "Install GTK3 Runtime for Windows, then run the command again."
        )


if __name__ == "__main__":
    main()
