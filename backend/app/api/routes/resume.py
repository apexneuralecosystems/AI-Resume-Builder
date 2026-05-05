"""Resume parsing routes."""

import json
from copy import deepcopy
from typing import Any, Literal

from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.core.config import get_settings
from app.core.constants import PROMPT_EDIT_SYSTEM_PROMPT
from app.services.openrouter_client import OpenRouterClient
from app.services.resume_parser import parse_resume_payload

router = APIRouter(prefix="/api", tags=["resume"])

_MAX_TRANSCRIPT_CHARS = 12_000


class PromptChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class PromptEditRequest(BaseModel):
    author: dict
    prompt: str
    layout: dict | None = None
    messages: list[PromptChatTurn] | None = Field(
        default=None,
        description="Prior chat turns only (excluding the current `prompt` message).",
    )
    jd_text: str | None = None
    resume_text: str | None = None


def _truncate(text: str, max_chars: int) -> str:
    if max_chars <= 0 or len(text) <= max_chars:
        return text.strip()
    return text[:max_chars].rstrip() + "\n\n[…truncated]"


def _prompt_edit_patch(llm_payload: dict[str, Any]) -> dict[str, Any]:
    """Extract updatedAuthor dict from LLM envelope (camelCase or snake_case)."""
    ua = llm_payload.get("updatedAuthor")
    if isinstance(ua, dict):
        return ua
    ua_snake = llm_payload.get("updated_author")
    if isinstance(ua_snake, dict):
        return ua_snake
    # Legacy: bare author-shaped object (no envelope)
    if isinstance(llm_payload.get("skills"), list) or isinstance(llm_payload.get("experience"), list):
        skip = frozenset({"updatedLayout", "updated_layout"})
        return {k: v for k, v in llm_payload.items() if k not in skip}
    raise ValueError("Model response missing updatedAuthor object")


def _layout_patch(llm_payload: dict[str, Any]) -> dict[str, Any] | None:
    ul = llm_payload.get("updatedLayout")
    if isinstance(ul, dict):
        return ul
    ul_snake = llm_payload.get("updated_layout")
    if isinstance(ul_snake, dict):
        return ul_snake
    return None


@router.post("/parse-resume")
async def parse_resume(
    resume: UploadFile = File(...),
    jd: UploadFile | None = File(None),
) -> dict:
    settings = get_settings()
    llm_client = OpenRouterClient(settings)
    return await parse_resume_payload(
        resume=resume,
        jd=jd,
        settings=settings,
        llm_client=llm_client,
    )


@router.post("/prompt-edit")
async def prompt_edit(payload: PromptEditRequest) -> dict:
    settings = get_settings()
    llm_client = OpenRouterClient(settings)
    base_author = payload.author if isinstance(payload.author, dict) else {}
    base_layout = deepcopy(payload.layout) if isinstance(payload.layout, dict) else {}
    jd_plain = _truncate((payload.jd_text or "").strip(), settings.max_jd_chars)
    resume_plain = _truncate(
        (payload.resume_text or "").strip(),
        settings.max_resume_chars if settings.max_resume_chars > 0 else 28_000,
    )
    prior_lines: list[str] = []
    for turn in payload.messages or []:
        label = turn.role.strip().lower()
        body = turn.content.strip()
        if label not in ("user", "assistant") or not body:
            continue
        prior_lines.append(f"{label.upper()}: {body}")
    transcript_raw = "\n".join(prior_lines)
    transcript = _truncate(transcript_raw, _MAX_TRANSCRIPT_CHARS)

    author_json_block = json.dumps(base_author, ensure_ascii=False)
    layout_json_block = json.dumps(base_layout or {}, ensure_ascii=False)

    user_content = f"""━━━━━━━━ JOB DESCRIPTION CONTEXT ( uploaded / separate file; optional ) ━━━━━━━━
{jd_plain or "(none supplied)"}

━━━━━━━━ VERBATIM RESUME SOURCE TEXT CONTEXT ( excerpt from uploaded file; optional ) ━━━━━━━━
{resume_plain or "(not supplied)"}

━━━━━━━━ CONVERSATION SO FAR ( chronological; may be empty ) ━━━━━━━━
{transcript or "(no prior turns)"}

━━━━━━━━ CURRENT AUTHOR JSON ( authoritative structured state apply edits onto ) ━━━━━━━━
{author_json_block}

━━━━━━━━ CURRENT LAYOUT JSON ━━━━━━━━
{layout_json_block}

━━━━━━━━ CURRENT USER MESSAGE ━━━━━━━━
{payload.prompt.strip()}

Apply the CURRENT USER MESSAGE in context of JOB DESCRIPTION + resume text + conversation. Return envelope JSON updatedAuthor + updatedLayout + assistantMessage."""
    raw = await llm_client.parse_to_json(
        system_prompt=PROMPT_EDIT_SYSTEM_PROMPT,
        user_content=user_content,
    )
    if not isinstance(raw, dict):
        raise HTTPException(status_code=502, detail="Prompt edit returned non-object JSON")

    try:
        patch_author = _prompt_edit_patch(raw)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    merged_author = {**base_author, **patch_author}

    merged_layout_out: dict[str, Any] = dict(base_layout) if isinstance(base_layout, dict) else {}
    lp = _layout_patch(raw)
    if isinstance(lp, dict):
        merged_layout_out.update(lp)

    summary = raw.get("assistantMessage") if isinstance(raw.get("assistantMessage"), str) else None
    if not summary:
        summary = raw.get("assistant_message") if isinstance(raw.get("assistant_message"), str) else None
    assistant_message = (summary or "").strip() or "Updated the resume JSON from your request."

    return {
        "updatedAuthor": merged_author,
        "updatedLayout": merged_layout_out,
        "assistantMessage": assistant_message,
    }
