"""Prompt-edit envelope extraction and shallow merge behavior."""

import pytest

from app.api.routes.resume import _layout_patch, _prompt_edit_patch


def test_prompt_edit_patch_camel_case():
    out = _prompt_edit_patch({"updatedAuthor": {"skills": [{"name": "Docker", "level": 85}]}})
    assert out == {"skills": [{"name": "Docker", "level": 85}]}


def test_prompt_edit_patch_snake_case():
    out = _prompt_edit_patch({"updated_author": {"bio": "hello"}})
    assert out == {"bio": "hello"}


def test_prompt_edit_patch_legacy_root():
    out = _prompt_edit_patch({"skills": [], "experience": [], "updatedLayout": {}})
    assert "skills" in out and "updatedLayout" not in out


def test_prompt_edit_patch_missing_raises():
    with pytest.raises(ValueError):
        _prompt_edit_patch({"foo": "bar"})


def test_layout_patch_shapes():
    assert _layout_patch({"updatedLayout": {"hidden": ["projects"]}}) == {"hidden": ["projects"]}
    assert _layout_patch({"updated_layout": {"hidden": []}}) == {"hidden": []}
