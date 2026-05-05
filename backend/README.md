# Backend Service

Production-ready FastAPI backend for resume parsing and JD-aware tailoring.

## Architecture

- `app/main.py`: app factory + middleware + router registration
- `app/api/routes`: API route modules
- `app/services`: business services (text extraction, OpenRouter + Claude models, parse orchestration)
- `app/core`: environment config and static prompt constants
- `app/schemas`: response schemas
- `tests`: backend tests

## Environment Variables

Anthropic Claude is called **via OpenRouter** using your OpenRouter API key ([OpenRouter keys](https://openrouter.ai/keys)).

- `OPENROUTER_API_KEY`: required for `/api/parse-resume`
- `ALLOWED_ORIGINS`: comma-separated CORS allow-list
- `OPENROUTER_MODEL`: default `anthropic/claude-sonnet-4.5` ([model list](https://openrouter.ai/models?q=anthropic%2Fclaude)); any OpenRouter slug works
- `OPENROUTER_TIMEOUT_SECONDS`: default `120`
- `OPENROUTER_MAX_TOKENS`: default `8192`
- `OPENROUTER_TEMPERATURE`: default `0.2`
- `SITE_URL`: default `https://resume.builder.apexneural.cloud`
- `APP_TITLE`: default `ResumeForge`
- `BACKEND_PORT`: default `8282`
- `RELOAD`: `true/false`, default `false`
- `MAX_RESUME_CHARS`: default `0` (no truncation)
- `MAX_JD_CHARS`: default `3000`
- `MAX_UPLOAD_BYTES`: default `15728640` (15MB)

## Local Run

```bash
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port ${BACKEND_PORT:-8282}
```

## Test

```bash
pytest -q
```

## API response — verbatim source text

Each successful `/api/parse-resume` response includes:

- `verbatimResumeText`: full text extracted from the uploaded resume file (exactly as returned by the parser; preserves every character present in extraction).
- `verbatimJobDescriptionText`: full JD text when a JD file was sent; otherwise `""`.

Structured fields (`experience`, `projects`, etc.) are still produced by the model and should follow the prompt’s verbatim rules; use `verbatimResumeText` when you need a guaranteed-lossless reference to what was read from the file.

Each parse response includes **`sectionIntegrity`**: headings detected from the verbatim file vs structured JSON. If anything is missing, **`supplementSections`** carries highlighted source excerpts the UI merges into the preview so sections are not dropped before export.

## Docker

```bash
docker build -t resume-backend .
docker run --rm -p 8282:8282 --env-file .env resume-backend
```
