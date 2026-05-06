# Autonomous Research Report System

FastAPI and Next.js application for generating professional research reports through a five-agent workflow:

1. Researcher gathers source evidence.
2. Analyst synthesizes patterns and supported claims.
3. Critic checks evidence quality and can trigger re-research.
4. Writer drafts report sections concurrently.
5. Editor polishes the final report and preserves citations.

The frontend is a ChatGPT-style interface for sessions, job progress, agent status, and downloadable report artifacts.

## Performance

- Tavily searches run in parallel through `MAX_SEARCH_WORKERS`.
- Multiple report jobs run concurrently through `MAX_JOB_WORKERS`.
- Report sections are drafted concurrently through `MAX_LLM_WORKERS`.
- Prompt responses are cached before LLM calls. Set `REDIS_URL` to use Redis as the primary shared cache with SQLite as a local fallback.
- CrewAI is imported lazily so API startup does not pay that cost until agent-role metadata is needed.

## Environment

```bash
OPENAI_API_KEY=...
TAVILY_API_KEY=...

OPENAI_MODEL=gpt-4.1-mini
REPORT_OUTPUT_DIR=reports
MAX_SOURCES=24
MAX_SEARCH_WORKERS=6
MAX_JOB_WORKERS=4
MAX_LLM_WORKERS=4

PROMPT_CACHE_BACKEND=auto
PROMPT_CACHE_PATH=data/prompt_cache.db
REDIS_URL=redis://localhost:6379/0
PROMPT_CACHE_TTL_SECONDS=604800
```

`PROMPT_CACHE_BACKEND` accepts `auto`, `redis`, `sqlite`, or `none`. In `auto`, Redis is used only when `REDIS_URL` is present; SQLite remains the fallback cache.

## Local Run

Backend:

```bash
python -m pip --python .venv\Scripts\python.exe install -r requirements.txt
.venv\Scripts\python.exe main.py --serve --host 127.0.0.1 --port 8000
```

Frontend:

```bash
cd frontend
npm install
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000`.

## API

- `GET /health`
- `GET /sessions`
- `POST /sessions`
- `GET /sessions/{session_id}`
- `POST /sessions/{session_id}/messages`
- `GET /jobs/{job_id}`
- `GET /messages/{message_id}/artifacts/{markdown|html|pdf}`

## Verification

```bash
.venv\Scripts\python.exe -m pytest
cd frontend
npm.cmd run build
```
