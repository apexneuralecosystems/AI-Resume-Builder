"""Orchestration service for parsing resume and optional JD files."""

from typing import Protocol
import os
import re
import tempfile
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import Settings
from app.core.constants import JD_PROMPT_ADDITION, NO_JD_STRICT_ADDITION, SYSTEM_PROMPT
from app.schemas.resume_output import ResumeOutput
from app.services.response_normalizer import normalize_resume_response
from app.services.section_integrity import compute_section_integrity
from app.services.text_extractor import extract_text


class SupportsResumeParseJson(Protocol):
    async def parse_to_json(self, system_prompt: str, user_content: str) -> dict:
        ...


def _normalize_line(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip().lower()


def _is_section_heading(line: str) -> bool:
    normalized = _normalize_line(line).rstrip(":")
    return normalized in {
        "professional summary",
        "summary",
        "profile",
        "experience",
        "professional experience",
        "work experience",
        "employment history",
        "projects",
        "education",
        "skills",
        "technical skills",
        "certifications",
        "interests",
        "languages",
    }


def _merge_missing_experience_highlights(normalized: dict, resume_text: str) -> None:
    experiences = normalized.get("experience")
    if not isinstance(experiences, list) or not resume_text.strip():
        return

    lines = [line.strip() for line in resume_text.replace("\r\n", "\n").split("\n") if line.strip()]
    if not lines:
        return

    def find_anchor_index(exp: dict) -> int:
        company = _normalize_line(str(exp.get("company") or ""))
        role = _normalize_line(str(exp.get("role") or ""))
        for idx, line in enumerate(lines):
            nline = _normalize_line(line)
            if company and company in nline:
                return idx
            if role and role in nline:
                return idx
        return -1

    for i, exp in enumerate(experiences):
        if not isinstance(exp, dict):
            continue
        existing = exp.get("highlights")
        if isinstance(existing, list) and len([x for x in existing if str(x).strip()]) > 0:
            continue

        start_idx = find_anchor_index(exp)
        if start_idx < 0:
            continue

        next_anchor = len(lines)
        for j in range(i + 1, len(experiences)):
            next_exp = experiences[j]
            if not isinstance(next_exp, dict):
                continue
            idx = find_anchor_index(next_exp)
            if idx > start_idx:
                next_anchor = idx
                break

        candidate_lines = lines[start_idx + 1 : next_anchor]
        role = _normalize_line(str(exp.get("role") or ""))
        company = _normalize_line(str(exp.get("company") or ""))
        period = _normalize_line(str(exp.get("period") or exp.get("duration") or ""))
        loc = _normalize_line(str(exp.get("location") or ""))
        typ = _normalize_line(str(exp.get("type") or ""))

        extracted: list[str] = []
        seen: set[str] = set()
        for raw in candidate_lines:
            nline = _normalize_line(raw).lstrip("•-▸")
            if not nline or _is_section_heading(raw):
                continue
            if nline in {role, company, period, loc, typ}:
                continue
            if len(nline) < 12:
                continue
            clean = raw.lstrip("•-▸ ").strip()
            key = _normalize_line(clean)
            if not key or key in seen:
                continue
            seen.add(key)
            extracted.append(clean)

        if extracted:
            exp["highlights"] = extracted

def _apply_char_limit(text: str, char_limit: int) -> str:
    """Apply char limit only when value is positive; otherwise keep full text."""
    if char_limit > 0:
        return text[:char_limit]
    return text


def _ensure_file_size_within_limit(file_obj: UploadFile, max_upload_bytes: int, label: str) -> None:
    file_size = getattr(file_obj, "size", None)
    if file_size is not None and file_size > max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"{label} exceeds max file size of {max_upload_bytes} bytes",
        )


async def _extract_upload_content(upload: UploadFile, default_suffix: str = ".pdf") -> str:
    suffix = Path(upload.filename or f"file{default_suffix}").suffix or default_suffix
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
        temp_file.write(await upload.read())
        temp_path = temp_file.name
    try:
        return extract_text(temp_path, upload.content_type or "", upload.filename or "file")
    finally:
        os.unlink(temp_path)


async def parse_resume_payload(
    *,
    resume: UploadFile,
    jd: UploadFile | None,
    settings: Settings,
    llm_client: SupportsResumeParseJson,
) -> dict:
    _ensure_file_size_within_limit(resume, settings.max_upload_bytes, "Resume")
    resume_text = await _extract_upload_content(resume)
    if not resume_text.strip():
        raise HTTPException(status_code=422, detail="Could not extract any text from the resume file")

    jd_text: str | None = None
    if jd and jd.filename:
        _ensure_file_size_within_limit(jd, settings.max_upload_bytes, "Job description")
        jd_text = await _extract_upload_content(jd)

    system_prompt = SYSTEM_PROMPT
    resume_payload_text = _apply_char_limit(resume_text, settings.max_resume_chars)
    user_content = (
        "Parse this resume exactly as provided.\n"
        "When no JD is provided, keep output aligned to uploaded resume content and order.\n\n"
        f"{resume_payload_text}"
    )

    if jd_text and jd_text.strip():
        jd_payload_text = _apply_char_limit(jd_text, settings.max_jd_chars)
        system_prompt += JD_PROMPT_ADDITION.format(jd_text=jd_payload_text)
        user_content += (
            "\n\nTarget job description for tailoring:\n\n"
            f"{jd_payload_text}"
            "\n\nUse the resume as source truth and tailor output toward this JD."
            "\nWhen JD is present, prioritize JD relevance while preserving factual correctness from resume."
        )
    else:
        system_prompt += NO_JD_STRICT_ADDITION
        user_content += (
            "\n\nNO JD PROVIDED:\n"
            "Do NOT tailor toward any target job. Keep entries, ordering, and wording aligned to the uploaded resume."
            "\nExtract all available data from the resume and return complete structured JSON for frontend rendering."
        )

    llm_response = await llm_client.parse_to_json(
        system_prompt=system_prompt,
        user_content=user_content,
    )
    normalized = normalize_resume_response(llm_response)
    _merge_missing_experience_highlights(normalized, resume_text)
    # Guaranteed exact copy of parsed file text (no LLM truncation/rewriting applies here)
    normalized["verbatimResumeText"] = resume_text
    normalized["verbatimJobDescriptionText"] = (
        jd_text.strip() if jd_text and jd_text.strip() else ""
    )
    normalized["sectionIntegrity"] = compute_section_integrity(resume_text, normalized)
    try:
        validated = ResumeOutput.model_validate(normalized)
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"Parsed resume failed schema validation: {exc}") from exc
    return validated.model_dump()
