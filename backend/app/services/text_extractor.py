"""Text extraction utilities for supported resume/JD file types."""

from pathlib import Path

from fastapi import HTTPException


def extract_text_pdf(file_path: str) -> str:
    """Extract PDF text using layout-preserving mode (helps multi-column resumes)."""
    import pdfplumber
    text = ""
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text(
                layout=True,
                x_tolerance=2,
                y_tolerance=2,
            )
            if page_text:
                text += page_text.strip() + "\n\n--- page break ---\n\n"
    return text.strip()


def _docx_unique_row_cells_text(row: object) -> list[str]:
    """Row cell texts in order without duplicate merges (common in merged Word tables)."""
    seen_tc: set[int] = set()
    texts: list[str] = []
    for cell in row.cells:
        tc = cell._tc
        if tc in seen_tc:
            continue
        seen_tc.add(tc)
        cleaned = cell.text.strip().replace("\n", " ")
        if cleaned:
            texts.append(cleaned)
    return texts


def extract_text_docx(file_path: str) -> str:
    from docx import Document

    doc = Document(file_path)
    parts: list[str] = []
    for paragraph in doc.paragraphs:
        t = paragraph.text.strip()
        if t:
            parts.append(t)

    for table_idx, table in enumerate(doc.tables, start=1):
        parts.append("")
        parts.append(f"[Table {table_idx}]")
        for row in table.rows:
            row_parts = _docx_unique_row_cells_text(row)
            if row_parts:
                parts.append(" | ".join(row_parts))
        parts.append("")
    return "\n".join(parts).strip()


def extract_text_doc(file_path: str) -> str:
    import mammoth

    with open(file_path, "rb") as source_file:
        result = mammoth.extract_raw_text(source_file)
    return result.value.strip()


def extract_text(file_path: str, content_type: str, filename: str) -> str:
    ext = Path(filename).suffix.lower()
    try:
        if ext == ".pdf" or "pdf" in content_type:
            return extract_text_pdf(file_path)
        if ext == ".docx" or "openxmlformats" in content_type:
            return extract_text_docx(file_path)
        if ext == ".doc" or "msword" in content_type:
            return extract_text_doc(file_path)
        with open(file_path, "r", encoding="utf-8", errors="ignore") as source_file:
            return source_file.read()
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=422, detail=f"Could not extract text from file: {str(exc)}") from exc
