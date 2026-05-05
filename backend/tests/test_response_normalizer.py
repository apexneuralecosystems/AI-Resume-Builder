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
