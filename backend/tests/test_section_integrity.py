"""Tests for resume section reconciliation from verbatim extraction."""

from app.services.section_integrity import compute_section_integrity


def test_detects_gap_when_education_missing_from_json() -> None:
    verbatim = """PRIYANKA K

Education

B.Sc Computer Science — State University — 2020

Experience

Data Engineer · Acme · 2022–present
Built pipelines daily.
"""

    profile = {
        "education": "",
        "experience": [
            {"role": "Data Engineer", "company": "Acme", "highlights": ["Built pipelines daily."]}
        ],
        "skills": [{"name": "Python", "level": 85}],
        "projects": [{"title": "P", "description": "x"}],
    }

    rep = compute_section_integrity(verbatim, profile)

    assert "education" in rep["sourceSectionsDetected"]
    assert rep["gapsCount"] >= 1
    assert rep["allStructuredSectionsMatchSource"] is False
    assert any(issue["section"] == "education" for issue in rep["issues"])
    edu_sup = next(s for s in rep["supplementSections"] if s["title"] == "Education")
    assert "Computer Science" in edu_sup["body"]


def test_all_match_returns_clean_report() -> None:
    verbatim = """Education\n\nB.Sc — Univ — 2020"""

    profile = {"education": "Univ — B.Sc — 2020"}

    rep = compute_section_integrity(verbatim, profile)
    assert rep["allStructuredSectionsMatchSource"] is True
    assert rep["gapsCount"] == 0
