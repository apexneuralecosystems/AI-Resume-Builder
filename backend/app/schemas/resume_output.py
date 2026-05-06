"""Pydantic models for parsed resume output validation and formatting."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


def _clean_text(value: str | None) -> str:
    if value is None:
        return ""
    return value.strip()


class SkillOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = ""
    level: int = 70

    @field_validator("name", mode="before")
    @classmethod
    def _name_clean(cls, value: Any) -> str:
        return _clean_text(str(value) if value is not None else "")

    @field_validator("level", mode="before")
    @classmethod
    def _level_default(cls, value: Any) -> int:
        try:
            lvl = int(value)
        except (TypeError, ValueError):
            return 70
        return max(0, min(100, lvl))


class CertificationOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = ""
    url: str = ""

    @field_validator("name", "url", mode="before")
    @classmethod
    def _clean(cls, value: Any) -> str:
        return _clean_text(str(value) if value is not None else "")


class ProjectOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    title: str = ""
    description: str = ""
    technology: str = ""
    link: str = ""

    @field_validator("title", "description", "technology", "link", mode="before")
    @classmethod
    def _clean(cls, value: Any) -> str:
        return _clean_text(str(value) if value is not None else "")


class ExperienceOut(BaseModel):
    model_config = ConfigDict(extra="ignore")

    role: str = ""
    company: str = ""
    period: str = ""
    location: str = ""
    type: str = ""
    highlights: list[str] = Field(default_factory=list)

    @model_validator(mode="before")
    @classmethod
    def _merge_description_into_highlights(cls, data: Any) -> Any:
        if not isinstance(data, dict):
            return data

        highlights_raw = data.get("highlights")
        merged: list[str] = []

        if isinstance(highlights_raw, list):
            merged.extend([str(item) for item in highlights_raw if str(item).strip()])
        elif isinstance(highlights_raw, str) and highlights_raw.strip():
            merged.extend([line.strip() for line in highlights_raw.splitlines() if line.strip()])

        for alt_key in ("description", "responsibilities", "details", "summary"):
            alt_val = data.get(alt_key)
            if isinstance(alt_val, str) and alt_val.strip():
                merged.extend([line.strip() for line in alt_val.splitlines() if line.strip()])
            elif isinstance(alt_val, list):
                merged.extend([str(item).strip() for item in alt_val if str(item).strip()])

        if merged:
            data["highlights"] = merged
        return data

    @field_validator("role", "company", "period", "location", "type", mode="before")
    @classmethod
    def _clean(cls, value: Any) -> str:
        return _clean_text(str(value) if value is not None else "")

    @field_validator("highlights", mode="before")
    @classmethod
    def _highlights_clean(cls, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        cleaned = [_clean_text(str(item)) for item in value if _clean_text(str(item))]
        return cleaned

class ResumeOutput(BaseModel):
    """Canonical parsed resume payload returned to frontend."""

    model_config = ConfigDict(extra="allow")

    id: str = ""
    name: str = ""
    role: str = ""
    email: str = ""
    phone: str = ""
    location: str = ""
    website: str = ""
    linkedIn: str = ""
    twitter: str = ""
    github: str = ""
    bio: str = ""
    aboutMe: str = ""
    company: str = ""
    yearsExperience: str = ""
    education: str = ""
    skills: list[SkillOut] = Field(default_factory=list)
    expertise: list[str] = Field(default_factory=list)
    specializations: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    techStack: str = ""
    certifications: list[CertificationOut] = Field(default_factory=list)
    projects: list[ProjectOut] = Field(default_factory=list)
    experience: list[ExperienceOut] = Field(default_factory=list)
    caseStudies: list[dict[str, Any]] = Field(default_factory=list)
    verbatimResumeText: str = ""
    verbatimJobDescriptionText: str = ""
    sectionIntegrity: dict[str, Any] | None = None

    @field_validator(
        "id",
        "name",
        "role",
        "email",
        "phone",
        "location",
        "website",
        "linkedIn",
        "twitter",
        "github",
        "bio",
        "aboutMe",
        "company",
        "yearsExperience",
        "education",
        "techStack",
        "verbatimResumeText",
        "verbatimJobDescriptionText",
        mode="before",
    )
    @classmethod
    def _clean_text_fields(cls, value: Any) -> str:
        return _clean_text(str(value) if value is not None else "")

    @field_validator("expertise", "specializations", "interests", mode="before")
    @classmethod
    def _clean_string_lists(cls, value: Any) -> list[str]:
        if not isinstance(value, list):
            return []
        return [_clean_text(str(item)) for item in value if _clean_text(str(item))]

    @model_validator(mode="after")
    def _apply_business_quality_rules(self) -> "ResumeOutput":
        # 1) Deduplicate skills by name (case-insensitive) and cap to 12.
        seen_skill: set[str] = set()
        deduped_skills: list[SkillOut] = []
        for skill in self.skills:
            key = skill.name.strip().lower()
            if not key or key in seen_skill:
                continue
            seen_skill.add(key)
            deduped_skills.append(skill)
            if len(deduped_skills) >= 12:
                break
        self.skills = deduped_skills

        # 2) Normalize, filter, and deduplicate experience entries by role+company+period.
        # Keep parser resilient by auto-fixing weak entries instead of failing full payload.
        seen_exp: set[tuple[str, str, str]] = set()
        deduped_experience: list[ExperienceOut] = []
        for exp in self.experience:
            role = exp.role.strip()
            company = exp.company.strip()
            period = exp.period.strip()

            # Drop empty shells.
            if not any([role, company, period, exp.highlights]):
                continue

            # If role exists but company is empty, skip invalid entry instead of raising.
            # This avoids hard-failing the full parse on one bad block.
            if role and not company:
                continue

            normalized_highlights: list[str] = []
            seen_hl: set[str] = set()
            for hl in exp.highlights:
                cleaned_hl = hl.strip()
                if not cleaned_hl:
                    continue
                key_hl = cleaned_hl.lower()
                if key_hl in seen_hl:
                    continue
                seen_hl.add(key_hl)
                normalized_highlights.append(cleaned_hl)
            exp.highlights = normalized_highlights

            key = (
                role.lower(),
                company.lower(),
                period.lower(),
            )
            if key in seen_exp:
                continue
            seen_exp.add(key)
            deduped_experience.append(exp)
        self.experience = deduped_experience

        # 3) Ensure at least one core content section exists.
        has_core_content = bool(
            self.experience
            or self.projects
            or self.education.strip()
            or self.skills
            or self.certifications
        )
        if not has_core_content:
            raise ValueError(
                "Parsed resume has no core content (experience/projects/education/skills/certifications)."
            )

        return self
