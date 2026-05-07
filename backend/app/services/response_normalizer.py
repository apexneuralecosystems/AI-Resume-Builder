"""Normalize LLM response to a stable resume JSON shape."""

from copy import deepcopy
import re
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


def _to_non_empty_lines(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [line.strip() for line in value.splitlines() if line.strip()]
    return []


def _is_non_experience_line(line: str) -> bool:
    normalized = re.sub(r"\s+", " ", line).strip().lower()
    if not normalized:
        return True

    # Pipe rows: project tables, skills catalogs, client/environment lines — never job bullets
    if "|" in line:
        left = line.split("|", 1)[0].strip()
        left_norm = re.sub(r"\s+", " ", left).lower().rstrip(":")
        if re.match(r"^project\s*\d+", left_norm):
            return True
        catalog_prefixes = (
            "client",
            "role",
            "environment",
            "languages",
            "databases",
            "microsoft azure",
        )
        for p in catalog_prefixes:
            if left_norm == p or left_norm.startswith(f"{p} ") or left_norm.startswith(f"{p}:"):
                return True

    exact_headings = {
        "projects summary",
        "description:",
        "roles and responsibilities:",
        "technical skills",
        "skills",
        "languages",
        "education",
        "certifications",
        "declaration",
    }
    if normalized in exact_headings:
        return True

    boundary_patterns = [
        r"^project\s*\d+\s*:",
        r"^project\s*\d+\s*\|",
        r"^(client|role|environment|languages|databases|microsoft azure)\s*\|",
        r"^i hereby declare\b",
        r"^place\s*:",
        r"\bhereby declare\b",
        r"^\s*place\s*:",
    ]
    return any(re.search(pattern, normalized) for pattern in boundary_patterns)


def _sanitize_experience_highlights(lines: list[str]) -> list[str]:
    cleaned: list[str] = []
    seen: set[str] = set()
    for raw in lines:
        line = raw.strip().lstrip("•▸- ").strip()
        if not line:
            continue
        if _is_non_experience_line(line):
            continue
        key = re.sub(r"\s+", " ", line).strip().lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(line)
    return cleaned


def _sanitize_experience(raw: Any) -> list[dict[str, Any]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        role = str(item.get("role") or "").strip()
        company = str(item.get("company") or "").strip()
        period = str(item.get("period") or item.get("duration") or "").strip()
        location = str(item.get("location") or "").strip()
        exp_type = str(item.get("type") or "").strip()

        highlights = _to_non_empty_lines(item.get("highlights"))
        if not highlights:
            for fallback_key in ("description", "responsibilities", "details", "summary"):
                highlights.extend(_to_non_empty_lines(item.get(fallback_key)))
        highlights = _sanitize_experience_highlights(highlights)

        if not any([role, company, period, location, exp_type, highlights]):
            continue

        out.append(
            {
                "role": role,
                "company": company,
                "period": period,
                "location": location,
                "type": exp_type,
                "highlights": highlights,
            }
        )
    return out


def _sanitize_projects(raw: Any) -> list[dict[str, str]]:
    if not isinstance(raw, list):
        return []
    out: list[dict[str, str]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        title = str(item.get("title") or "").strip()
        description = str(item.get("description") or item.get("summary") or "").strip()
        technology = str(item.get("technology") or item.get("techStack") or item.get("stack") or "").strip()
        link = str(item.get("link") or item.get("url") or "").strip()
        if not any([title, description, technology, link]):
            continue
        out.append(
            {
                "title": title,
                "description": description,
                "technology": technology,
                "link": link,
            }
        )
    return out


def clean_experience_highlights_value(value: Any) -> list[str]:
    """Public: strip invalid lines from experience bullets (used after LLM + merge)."""
    return _sanitize_experience_highlights(_to_non_empty_lines(value))


def is_disallowed_experience_bullet_line(line: str) -> bool:
    """True if this line must not appear in experience.highlights (projects/skills/declaration rows)."""
    stripped = line.strip().lstrip("•▸- ").strip()
    return _is_non_experience_line(stripped)


def re_sanitize_all_experience_highlights(normalized: dict) -> None:
    """Re-run highlight filters on every experience entry (e.g. after verbatim merge)."""
    exps = normalized.get("experience")
    if not isinstance(exps, list):
        return
    for exp in exps:
        if isinstance(exp, dict):
            exp["highlights"] = clean_experience_highlights_value(exp.get("highlights"))


def normalize_resume_response(raw_response: dict) -> dict:
    """Ensure all expected resume keys exist while preserving extra keys."""
    normalized = deepcopy(DEFAULT_RESUME_RESPONSE)
    normalized.update(raw_response or {})
    normalized["certifications"] = _sanitize_certifications(normalized.get("certifications"))
    normalized["experience"] = _sanitize_experience(normalized.get("experience"))
    normalized["projects"] = _sanitize_projects(normalized.get("projects"))
    if isinstance(normalized.get("education"), list):
        normalized["education"] = "\n".join(_to_non_empty_lines(normalized.get("education")))
    return normalized
