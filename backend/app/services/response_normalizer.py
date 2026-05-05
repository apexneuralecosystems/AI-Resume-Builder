"""Normalize LLM response to a stable resume JSON shape."""

from copy import deepcopy
from typing import Any


DEFAULT_RESUME_RESPONSE: dict = {
    "id": "",
    "name": "",
    "role": "",
    "email": "",
    "phone": "",
    "location": "",
    "website": "",
    "linkedIn": "",
    "twitter": "",
    "github": "",
    "bio": "",
    "aboutMe": "",
    "company": "",
    "yearsExperience": "",
    "education": "",
    "skills": [],
    "expertise": [],
    "specializations": [],
    "interests": [],
    "techStack": "",
    "certifications": [],
    "projects": [],
    "experience": [],
    "caseStudies": [],
    # Filled server-side from extracted file text — full source, character-for-character from parser
    "verbatimResumeText": "",
    "verbatimJobDescriptionText": "",
}


def _sanitize_certifications(raw: Any) -> list[dict[str, str]]:
    """Drop empty names and coerce url to string (avoids blank hrefs in templates)."""
    if not isinstance(raw, list):
        return []
    result: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        name = (item.get("name") or "").strip()
        if not name:
            continue
        url = (item.get("url") or "").strip()
        result.append({"name": name, "url": url})
    return result


def normalize_resume_response(raw_response: dict) -> dict:
    """Ensure all expected resume keys exist while preserving extra keys."""
    normalized = deepcopy(DEFAULT_RESUME_RESPONSE)
    normalized.update(raw_response or {})
    normalized["certifications"] = _sanitize_certifications(normalized.get("certifications"))
    return normalized
