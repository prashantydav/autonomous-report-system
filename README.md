# AI Portfolio & Resume Generator

This project now ships a Next.js App Router frontend that turns a resume into a portfolio website and a regenerated resume variant, then deploys the generated portfolio directly to Vercel.

## Flow

1. Upload `PDF`, `DOCX`, or `TXT`
2. Parse the resume into structured data
3. Generate portfolio-ready copy using only resume content
4. Preview and edit the generated portfolio
5. Export the regenerated resume text
6. Deploy a static portfolio bundle to Vercel

## Frontend Stack

- Next.js 15 App Router
- React 19
- Framer Motion
- `pdf-parse` and `mammoth` for resume extraction
- OpenAI Responses API with a strict JSON schema when `OPENAI_API_KEY` is set
- Deterministic no-hallucination fallback generation when no OpenAI key is present

## Key Features

- Resume upload for `PDF`, `DOCX`, and `TXT`
- Structured extraction for name, contact info, skills, experience, projects, and education
- Portfolio generation with templates: `minimal`, `ai-engineer`, `freelancer`, `modern`
- Resume regeneration into a cleaner downloadable variant
- Animated hero, skill grouping, project filters, expandable cards, timeline experience, theme toggle, smooth scroll, contact form, and resume download
- Direct Vercel deployment through the Vercel API

## Environment Variables

Frontend runtime:

```bash
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4.1-mini
VERCEL_ACCESS_TOKEN=...
VERCEL_PROJECT_NAME=
VERCEL_TEAM_ID=
VERCEL_TEAM_SLUG=
```

Notes:

- `OPENAI_API_KEY` is optional. If it is missing, the app still generates a portfolio using deterministic rewriting based only on parsed resume data.
- `VERCEL_ACCESS_TOKEN` is required for the deploy button.
- `VERCEL_PROJECT_NAME` is optional. If omitted, the deploy route uses the requested site name or a slug derived from the resume name.
- `VERCEL_TEAM_ID` or `VERCEL_TEAM_SLUG` is optional and only needed when deploying into a Vercel team instead of a personal account.

## Local Run

```bash
cd autonomous-report-system/frontend
npm install
cmd /c npm run dev
```

Open `http://localhost:3000`.

## Production Check

```bash
cd autonomous-report-system/frontend
cmd /c npm run build
```

## API Routes

- `POST /api/resume/parse`
- `POST /api/portfolio/generate`
- `POST /api/deploy/vercel`

## Vercel Deployment Behavior

The deploy route generates a static bundle in memory:

- `index.html`
- `styles.css`
- `script.js`
- `resume.txt`
- `_redirects`

That bundle is uploaded through Vercel's deployment API as inline files, which keeps the deployment flow independent from a separate Next.js build pipeline for the generated portfolio site.

## Verification

Verified locally with:

```bash
cd autonomous-report-system/frontend
cmd /c npm run build
```
