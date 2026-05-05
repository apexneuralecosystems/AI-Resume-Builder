"""Detect resume sections from verbatim extraction and reconcile with structured LLM JSON."""

from __future__ import annotations

import re
from collections import OrderedDict, defaultdict
from typing import Any

# Canonical key | human title | headings that activate this bucket (normalized, no trailing colon)
SECTION_DEFS: list[tuple[str, str, frozenset[str]]] = [
    (
        "summary",
        "Professional Summary",
        frozenset(
            {
                "professional summary",
                "career objective",
                "career objectives",
                "objective",
                "summary",
                "profile",
                "about me",
                "personal profile",
            }
        ),
    ),
    (
        "experience",
        "Experience",
        frozenset(
            {
                "experience",
                "professional experience",
                "work experience",
                "employment",
                "employment history",
                "work history",
                "career history",
                "relevant experience",
            }
        ),
    ),
    (
        "education",
        "Education",
        frozenset(
            {
                "education",
                "academic background",
                "academic qualification",
                "qualifications",
                "academic qualifications",
                "educational qualification",
                "academics",
            }
        ),
    ),
    (
        "skills",
        "Technical Skills",
        frozenset(
            {
                "skills",
                "technical skills",
                "core competencies",
                "areas of expertise",
                "technologies",
                "tech stack",
                "technical expertise",
                "skills summary",
                "competencies",
            }
        ),
    ),
    (
        "projects",
        "Projects",
        frozenset(
            {
                "projects",
                "projects summary",
                "key projects",
                "notable projects",
                "project experience",
                "selected projects",
                "major projects",
            }
        ),
    ),
    (
        "certifications",
        "Certifications",
        frozenset(
            {
                "certifications",
                "certification",
                "licenses",
                "licenses and certifications",
                "credentials",
                "professional certifications",
            }
        ),
    ),
    (
        "languages",
        "Languages",
        frozenset(
            {
                "languages",
                "language proficiency",
                "language skills",
            }
        ),
    ),
    (
        "awards",
        "Awards & Honors",
        frozenset(
            {
                "awards",
                "honors",
                "achievements",
                "accomplishments",
            }
        ),
    ),
    (
        "publications",
        "Publications",
        frozenset({"publications", "papers", "research publications"}),
    ),
    (
        "interests",
        "Interests",
        frozenset({"interests", "hobbies", "areas of interest"}),
    ),
    (
        "references",
        "References",
        frozenset({"references", "referees"}),
    ),
    (
        "trainings",
        "Trainings",
        frozenset({"training", "trainings", "workshops", "courses"},),
    ),
    (
        "volunteer",
        "Volunteer",
        frozenset({"volunteer", "volunteering", "volunteer experience"}),
    ),
]

_TABLE_HDR = re.compile(r"^\s*\[\s*Table\s+\d+\s*\]\s*$", re.IGNORECASE)


def _normalize_heading_line(line: str) -> str | None:
    stripped = line.strip()
    if not stripped:
        return None
    # Word often uses tab-padded lines like "\tProfessional Summary\t"
    stripped = " ".join(stripped.split())
    if len(stripped) > 90:
        return None
    # Skip numbered-only or table rows dominated by pipes
    if stripped.count("|") >= 3 and stripped.count("|") >= len(stripped) // 8:
        return None
    if "." in stripped[1:-1] and stripped.count(".") >= 2:
        return None
    return stripped.lower().rstrip(".").rstrip(":").strip()


def _classify_line(line: str) -> str | None:
    if _TABLE_HDR.match(line.strip()):
        return "_tables_raw"
    norm = _normalize_heading_line(line)
    if not norm:
        return None
    for key, _title, aliases in SECTION_DEFS:
        if norm in aliases:
            return key
        for a in aliases:
            if norm.startswith(a + " ") or norm.endswith(" " + a):
                return key
    return None


def _split_buckets(verbatim: str) -> tuple[dict[str, list[str]], set[str]]:
    """Return bucket lines per canonical section + set of headings seen."""
    lines = verbatim.replace("\r\n", "\n").split("\n")
    buckets: dict[str, list[str]] = defaultdict(list)
    current_key = "_preamble"
    headings_seen: set[str] = set()

    for line in lines:
        cls = _classify_line(line)
        if cls == "_tables_raw":
            buckets["_tables_raw"].append(line.strip())
            current_key = "_tables_raw"
            continue
        if cls is None:
            buckets[current_key].append(line.rstrip("\n"))
            continue
        current_key = cls
        headings_seen.add(cls)

    return dict(buckets), headings_seen


def _body_non_trivial(joined: str, min_chars: int = 25) -> bool:
    trimmed = joined.strip().strip("|").strip("-")
    alnum_count = sum(1 for c in trimmed if c.isalnum())
    return len(trimmed) >= min_chars or alnum_count >= 15


def _structured_has(canonical_key: str, profile: dict[str, Any]) -> bool:
    if canonical_key == "summary":
        return bool((profile.get("bio") or "").strip() or (profile.get("aboutMe") or "").strip())

    if canonical_key == "experience":
        rows = profile.get("experience")
        if not isinstance(rows, list) or len(rows) == 0:
            return False
        for ex in rows:
            if not isinstance(ex, dict):
                continue
            hl = ex.get("highlights")
            has_hl = isinstance(hl, list) and len(hl) > 0
            if (
                (ex.get("role") or "").strip()
                or (ex.get("company") or "").strip()
                or has_hl
                or (ex.get("period") or "").strip()
                or (ex.get("duration") or "").strip()
            ):
                return True
        return False

    if canonical_key == "education":
        return bool((profile.get("education") or "").strip())

    if canonical_key == "skills":
        skills = profile.get("skills")
        ts = profile.get("techStack")
        expertise = profile.get("expertise")
        specs = profile.get("specializations")
        skills = skills if isinstance(skills, list) else []
        expertise = expertise if isinstance(expertise, list) else []
        specs = specs if isinstance(specs, list) else []
        if len(skills) > 0:
            return True
        if isinstance(ts, str) and ts.strip():
            return True
        if len(expertise) > 0:
            return True
        if len(specs) > 0:
            return True
        return False

    if canonical_key == "projects":
        p = profile.get("projects")
        cs = profile.get("caseStudies")
        p = p if isinstance(p, list) else []
        cs = cs if isinstance(cs, list) else []
        return len(p) > 0 or len(cs) > 0

    if canonical_key == "certifications":
        c = profile.get("certifications")
        return isinstance(c, list) and len(c) > 0

    if canonical_key == "interests":
        i = profile.get("interests")
        return isinstance(i, list) and len(i) > 0

    if canonical_key == "languages":
        # often folded into techStack/skills — treat as structured if explicitly present (future-proof)
        lang = profile.get("languages")
        if isinstance(lang, list) and len(lang) > 0:
            return True
        return False

    if canonical_key in ("awards", "publications", "references", "trainings", "volunteer"):
        fld = profile.get(canonical_key)
        if isinstance(fld, list) and len(fld) > 0:
            return True
        return bool((fld or "").strip() if isinstance(fld, str) else False)

    return True


def _title_for(canonical_key: str) -> str:
    for k, title, _ in SECTION_DEFS:
        if k == canonical_key:
            return title
    return canonical_key.replace("_", " ").title()


def _dedupe_by_canonical_gap(gaps: list[dict[str, str]]) -> list[dict[str, str]]:
    merged: OrderedDict[str, dict[str, str]] = OrderedDict()
    for gap in gaps:
        ck = gap.get("canonical") or ""
        if not ck:
            continue
        if ck not in merged or len(gap.get("verbatimPreview", "")) > len(merged[ck].get("verbatimPreview", "")):
            merged[ck] = gap
    return list(merged.values())


def _dedupe_supplements(items: list[dict[str, str]]) -> list[dict[str, str]]:
    merged: OrderedDict[str, str] = OrderedDict()
    for raw in items:
        title = (raw.get("title") or "").strip()
        body = (raw.get("body") or "").strip()
        if not title:
            continue
        if title not in merged or len(body) > len(merged[title]):
            merged[title] = body
    return [{"title": t, "body": b} for t, b in merged.items()]


def compute_section_integrity(verbatim_resume: str, profile: dict[str, Any]) -> dict[str, Any]:
    buckets, headings_seen = _split_buckets(verbatim_resume)

    gaps: list[dict[str, str]] = []
    supplement_sections: list[dict[str, str]] = []

    if not verbatim_resume.strip():
        return {
            "sourceSectionsDetected": [],
            "gapsCount": 0,
            "allStructuredSectionsMatchSource": True,
            "issues": [],
            "supplementSections": [],
        }

    # Tables from Word often carry skills/project metadata
    tbl_joined = "\n".join(buckets.get("_tables_raw", []) or [])
    tbl_substantial = _body_non_trivial(tbl_joined, min_chars=20)

    canonical_keys_ordered = [k for k, _t, _a in SECTION_DEFS]

    for key in canonical_keys_ordered:
        if key not in headings_seen:
            continue
        body_lines = buckets.get(key) or []
        body = "\n".join(body_lines).strip()

        structured_ok = _structured_has(key, profile)
        verbatim_ok = _body_non_trivial(body)

        if verbatim_ok and not structured_ok:
            preview = body[:320] + ("…" if len(body) > 320 else "")
            gaps.append(
                {
                    "canonical": key,
                    "title": _title_for(key),
                    "verbatimPreview": preview,
                }
            )
            supplement_sections.append({"title": _title_for(key), "body": body})

    if tbl_substantial:
        tbl_title = "Structured Tables (source)"
        already_titles = {s["title"] for s in supplement_sections}
        if tbl_title not in already_titles:
            skill_ok = _structured_has("skills", profile)
            proj_ok = _structured_has("projects", profile)
            if not skill_ok or not proj_ok:
                block = tbl_joined
                preview = block[:320] + ("…" if len(block) > 320 else "")
                gaps.append(
                    {
                        "canonical": "_tables_raw",
                        "title": tbl_title,
                        "verbatimPreview": preview,
                    }
                )
                supplement_sections.append({"title": tbl_title, "body": block})

    gaps = _dedupe_by_canonical_gap(gaps)
    supplement_sections = _dedupe_supplements(supplement_sections)

    issues = [{"section": g["canonical"], "title": g["title"], "reason": "found_in_source_not_in_structured_output"} for g in gaps]

    return {
        "sourceSectionsDetected": sorted(headings_seen),
        "gapsCount": len(gaps),
        "allStructuredSectionsMatchSource": len(gaps) == 0,
        "issues": issues,
        "supplementSections": supplement_sections,
    }
