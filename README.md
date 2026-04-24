# Autonomous Research & Report Generation System

A five-agent research crew with a FastAPI backend and a Next.js chat-style frontend. It turns any topic into a professional cited report, stores session history, caches prompts, and exports Markdown, HTML, and PDF.

## Agent Crew

- `Researcher`: plans diverse search queries and collects 20+ sources through Tavily.
- `Analyst`: synthesizes findings, patterns, contradictions, and cited claims.
- `Critic`: fact-checks the analysis, flags unsupported assertions, and requests targeted re-research.
- `Writer`: drafts the structured report with inline citations.
- `Editor`: improves clarity, reduces redundancy, and enforces a professional voice.

The implementation uses CrewAI agent definitions for portfolio-visible role modeling, with a controlled Python orchestration layer for predictable execution, retries, caching, background jobs, and export.

## Backend Setup

```bash
cd autonomous-report-system
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Add:

- `OPENAI_API_KEY`
- `TAVILY_API_KEY`

Optional:

- `CORS_ALLOW_ORIGINS=http://localhost:3000`
- `DATABASE_PATH=data/app.db`
- `PROMPT_CACHE_PATH=data/prompt_cache.db`
- `MAX_JOB_WORKERS=4`
- `MAX_SEARCH_WORKERS=6`

## Backend Run

```bash
uvicorn app:app --host 0.0.0.0 --port 8000
```

API surface:

- `GET /health`
- `GET /sessions`
- `POST /sessions`
- `GET /sessions/{session_id}`
- `POST /sessions/{session_id}/messages`
- `GET /jobs/{job_id}`

## CLI Run

```bash
python main.py "How will autonomous AI agents change enterprise software delivery over the next three years?"
```

Outputs are written to `reports/`:

- Markdown report
- HTML report
- PDF report rendered with WeasyPrint

## Frontend Setup

```bash
cd frontend
npm install
set NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
npm run dev
```

The UI provides:

- a left sidebar with previous sessions
- a chat-style message view
- background job polling
- report artifact paths attached to completed assistant messages

## Project Structure

```text
autonomous-report-system/
  app.py
  main.py
  render.yaml
  requirements.txt
  frontend/
    app/
    components/
  src/autonomous_report_system/
    api.py
    api_models.py
    agents.py
    config.py
    llm.py
    models.py
    pipeline.py
    render.py
    research.py
    services.py
    storage.py
  tests/
    test_core.py
```

## Verification

```bash
python -m pytest -q
```

## Render Deployment

The repo includes a [render.yaml](C:/Users/Admin/AI-Agents/autonomous-report-system/render.yaml) blueprint for two web services:

- `autonomous-report-system-api`
- `autonomous-report-system-ui`

Deployment notes:

- The backend uses a persistent disk mounted at `/var/data` so SQLite data, prompt cache, and generated reports survive deploys and restarts.
- Set `OPENAI_API_KEY` and `TAVILY_API_KEY` as secret environment variables in Render.
- After the backend service is created, set `NEXT_PUBLIC_API_BASE_URL` on the frontend service to the backend's public Render URL, such as `https://autonomous-report-system-api.onrender.com`.
- `CORS_ALLOW_ORIGINS` can remain unset on Render unless you want to restrict access to specific frontend origins.

## Notes

- A full run requires network access and valid OpenAI/Tavily keys.
- The critic can trigger a second focused research pass when the initial synthesis has weak evidence.
- The renderer keeps source URLs in the Markdown, HTML, and PDF outputs for auditability.
- Tavily searches are executed concurrently.
- report generation jobs run in a background thread pool
- prompt responses are cached in SQLite by model + prompt hash
- Render deployment is configured for separate backend and frontend services
