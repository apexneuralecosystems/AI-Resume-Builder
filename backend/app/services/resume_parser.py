"""Orchestration service for parsing resume and optional JD files."""

from typing import Protocol
import os
import tempfile
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import Settings
from app.core.constants import JD_PROMPT_ADDITION, SYSTEM_PROMPT
from app.services.response_normalizer import normalize_resume_response
from app.services.section_integrity import compute_section_integrity
from app.services.text_extractor import extract_text


class SupportsResumeParseJson(Protocol):
    async def parse_to_json(self, system_prompt: str, user_content: str) -> dict:
        ...

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
    user_content = f"Parse this resume:\n\n{resume_payload_text}"

    if jd_text and jd_text.strip():
        jd_payload_text = _apply_char_limit(jd_text, settings.max_jd_chars)
        system_prompt += JD_PROMPT_ADDITION.format(jd_text=jd_payload_text)
        user_content += (
            "\n\nTarget job description for tailoring:\n\n"
            f"{jd_payload_text}"
            "\n\nUse the resume as source truth and tailor output toward this JD."
        )

    llm_response = await llm_client.parse_to_json(
        system_prompt=system_prompt,
        user_content=user_content,
    )
    normalized = normalize_resume_response(llm_response)
    # Guaranteed exact copy of parsed file text (no LLM truncation/rewriting applies here)
    normalized["verbatimResumeText"] = resume_text
    normalized["verbatimJobDescriptionText"] = (
        jd_text.strip() if jd_text and jd_text.strip() else ""
    )
    normalized["sectionIntegrity"] = compute_section_integrity(resume_text, normalized)
    return normalized
