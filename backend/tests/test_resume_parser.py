"""Tests for JD-aware resume parsing orchestration."""

import asyncio
from io import BytesIO

from fastapi import UploadFile

from app.core.config import Settings
from app.core.constants import JD_PROMPT_ADDITION, SYSTEM_PROMPT
from app.services.resume_parser import parse_resume_payload


class FakeLlmClient:
    """Capture prompt payload without calling external APIs."""

    def __init__(self) -> None:
        self.last_system_prompt: str | None = None
        self.last_user_content: str | None = None

    async def parse_to_json(self, system_prompt: str, user_content: str) -> dict:
        self.last_system_prompt = system_prompt
        self.last_user_content = user_content
        return {"name": "Praveen", "skills": [{"name": "FastAPI", "level": 90}]}


class MissingHighlightsLlmClient:
    async def parse_to_json(self, system_prompt: str, user_content: str) -> dict:
        return {
            "name": "Praveen",
            "experience": [
                {
                    "role": "Azure Data Engineer",
                    "company": "Nayagara Technologies Pvt ltd",
                    "period": "Jan 2021 to Till date",
                    "type": "Full-time",
                    "highlights": [
                        "Developed pipelines in azure data factory to fetch data from different sources"
                    ],
                },
                {
                    "role": "Operations Associate",
                    "company": "My Ally (Acquired by Phenom)",
                    "period": "Oct 2016 to Sep 2019",
                    "type": "Full-time",
                    "highlights": [],
                },
            ],
        }


def _make_settings() -> Settings:
    return Settings(
        app_name="Resume Builder API",
        allowed_origins=["http://localhost:5173"],
        openrouter_model="anthropic/claude-sonnet-4.5",
        openrouter_timeout_seconds=120.0,
        openrouter_max_tokens=4096,
        openrouter_temperature=0.2,
        site_url="http://localhost",
        app_title="ResumeForge",
        backend_port=8282,
        backend_reload=False,
        max_resume_chars=6000,
        max_jd_chars=3000,
        max_upload_bytes=15728640,
        openrouter_api_key="dummy",
    )


def test_parse_resume_includes_jd_when_provided() -> None:
    settings = _make_settings()
    client = FakeLlmClient()
    resume = UploadFile(filename="resume.txt", file=BytesIO(b"Backend engineer with FastAPI experience"))
    jd = UploadFile(filename="jd.txt", file=BytesIO(b"Looking for FastAPI and Docker production skills"))

    result = asyncio.run(
        parse_resume_payload(
            resume=resume,
            jd=jd,
            settings=settings,
            llm_client=client,
        )
    )

    assert result["name"] == "Praveen"
    assert result["skills"] == [{"name": "FastAPI", "level": 90}]
    assert "sectionIntegrity" in result
    assert result["sectionIntegrity"]["gapsCount"] >= 0
    assert result["verbatimResumeText"] == "Backend engineer with FastAPI experience"
    assert "verbatimJobDescriptionText" in result
    assert "FastAPI and Docker production skills" in result["verbatimJobDescriptionText"]
    assert "experience" in result
    assert isinstance(result["experience"], list)
    assert "education" in result
    assert "caseStudies" in result
    assert client.last_system_prompt is not None
    assert client.last_user_content is not None
    assert SYSTEM_PROMPT in client.last_system_prompt
    assert "JOB DESCRIPTION:" in client.last_system_prompt
    assert "Docker production skills" in client.last_system_prompt
    assert JD_PROMPT_ADDITION.split("{jd_text}")[0].strip() in client.last_system_prompt
    assert "Target job description for tailoring:" in client.last_user_content
    assert "FastAPI and Docker production skills" in client.last_user_content


def test_parse_resume_recovers_missing_highlights_from_verbatim_text() -> None:
    settings = _make_settings()
    client = MissingHighlightsLlmClient()
    resume_text = """Azure Data Engineer
Nayagara Technologies Pvt ltd
Jan 2021 to Till date
Full-time
Developed pipelines in azure data factory to fetch data from different sources
Operations Associate
My Ally (Acquired by Phenom)
Oct 2016 to Sep 2019
Full-time
Provided production support by troubleshooting SQL-related issues
Collaborated closely with business analysts and stakeholders
"""
    resume = UploadFile(filename="resume.txt", file=BytesIO(resume_text.encode("utf-8")))

    result = asyncio.run(
        parse_resume_payload(
            resume=resume,
            jd=None,
            settings=settings,
            llm_client=client,
        )
    )

    experience = result["experience"]
    assert len(experience) >= 2
    ops_role = next((e for e in experience if e["role"] == "Operations Associate"), None)
    assert ops_role is not None
    assert isinstance(ops_role["highlights"], list)
    assert len(ops_role["highlights"]) >= 1
    assert any("troubleshooting SQL-related issues" in h for h in ops_role["highlights"])
