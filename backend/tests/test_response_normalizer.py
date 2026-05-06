"""Tests for response normalization guarantees."""

from app.services.response_normalizer import normalize_resume_response


def test_normalizer_fills_missing_required_keys() -> None:
    normalized = normalize_resume_response({"name": "Alex"})

    assert normalized["name"] == "Alex"
    assert "experience" in normalized
    assert "projects" in normalized
    assert "skills" in normalized
    assert "education" in normalized
    assert "caseStudies" in normalized
    assert "verbatimResumeText" in normalized
    assert normalized["verbatimResumeText"] == ""


def test_normalizer_preserves_unknown_extra_keys() -> None:
    normalized = normalize_resume_response({"customField": "kept"})
    assert normalized["customField"] == "kept"


def test_normalizer_filters_invalid_certifications() -> None:
    normalized = normalize_resume_response(
        {
            "certifications": [
                {"name": "", "url": "https://a.com"},
                {"name": "OK Cert", "url": ""},
                {"name": "Another", "url": "invalid"},
                "not-a-dict",
            ]
        }
    )
    certs = normalized["certifications"]
    assert len(certs) == 2
    assert certs[0]["name"] == "OK Cert" and certs[0]["url"] == ""
    assert certs[1]["name"] == "Another" and certs[1]["url"] == "invalid"


def test_normalizer_maps_experience_description_into_highlights() -> None:
    normalized = normalize_resume_response(
        {
            "experience": [
                {
                    "role": "Operations Associate",
                    "company": "My Ally",
                    "duration": "Oct 2016 to Sep 2019",
                    "description": "Handled customer operations\nPrepared KPI reports",
                }
            ]
        }
    )
    exp = normalized["experience"][0]
    assert exp["period"] == "Oct 2016 to Sep 2019"
    assert exp["highlights"] == ["Handled customer operations", "Prepared KPI reports"]


def test_normalizer_maps_project_alias_fields() -> None:
    normalized = normalize_resume_response(
        {
            "projects": [
                {
                    "title": "Migration",
                    "summary": "Moved workloads to cloud",
                    "stack": "Azure, Python",
                    "url": "https://example.com",
                }
            ]
        }
    )
    project = normalized["projects"][0]
    assert project["description"] == "Moved workloads to cloud"
    assert project["technology"] == "Azure, Python"
    assert project["link"] == "https://example.com"


def test_normalizer_filters_non_experience_highlight_lines() -> None:
    normalized = normalize_resume_response(
        {
            "experience": [
                {
                    "role": "Operations Associate",
                    "company": "My Ally",
                    "highlights": [
                        "Projects Summary",
                        "Description:",
                        "Project 1: | Novartis",
                        "Environment | Azure Data Factory, SQL",
                        "I hereby declare that all details are true.",
                        "Provided production support by troubleshooting SQL-related issues.",
                    ],
                }
            ]
        }
    )
    highlights = normalized["experience"][0]["highlights"]
    assert highlights == ["Provided production support by troubleshooting SQL-related issues."]
