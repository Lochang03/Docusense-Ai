"""
FR-04: Multi-Mode Document Summarization endpoints.
FR-04.1/04.2: generate + fetch the executive summary, key takeaways, risks/actions.
FR-04.3: export the summary as Markdown, PDF, or plain text (for clipboard).
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from fpdf import FPDF
from fpdf.errors import FPDFException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.document import Document, DocumentStatus
from app.models.summary import Summary
from app.auth import get_owned_document
from app.ingestion.summarizer import generate_summary

router = APIRouter(prefix="/documents", tags=["summary"])


def _serialize(summary: Summary) -> dict:
    return {
        "status": summary.status,
        "executive_summary": summary.executive_summary,
        "key_takeaways": summary.key_takeaways,
        "risks_actions": summary.risks_actions,
        "error_message": summary.error_message,
    }


def _to_markdown(summary: Summary) -> str:
    lines = ["# Document Summary", "", "## Executive Summary", summary.executive_summary or "", ""]

    lines.append("## Key Takeaways")
    for item in (summary.key_takeaways or []):
        lines.append(f"- {item}")
    lines.append("")

    lines.append("## Risks & Action Items")
    if summary.risks_actions:
        for item in summary.risks_actions:
            label = item.get("type", "note").upper()
            lines.append(f"- **[{label}]** {item.get('description', '')} (Page {item.get('page_num', '?')})")
    else:
        lines.append("_No risks or action items identified._")

    return "\n".join(lines)


def _sanitize_for_pdf(text) -> str:
    text = str(text) if text is not None else ""
    replacements = {
        "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"',
        "\u2013": "-", "\u2014": "-",
        "\u2026": "...",
        "\u2022": "-",
        "\u00a0": " ",
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    text = "".join(c if 32 <= ord(c) < 127 else " " for c in text)
    return " ".join(text.split())


def _estimate_lines(pdf: FPDF, text: str, effective_width: float) -> int:
    """
    Rough word-wrap estimate of how many lines `text` will take at the
    current font/size. auto_page_break is off in this file, so we must
    add pages ourselves -- without an accurate estimate here, long
    paragraphs silently overflow past the bottom of the page instead of
    starting a new one.
    """
    if not text:
        return 1
    words = text.split(" ")
    lines = 1
    current_width = 0.0
    space_width = pdf.get_string_width(" ")
    for word in words:
        word_width = pdf.get_string_width(word)
        if current_width > 0 and current_width + space_width + word_width > effective_width:
            lines += 1
            current_width = word_width
        else:
            current_width += (space_width if current_width > 0 else 0) + word_width
    return lines


def _ensure_space(pdf: FPDF, needed: float = 12):
    """
    fpdf2's automatic page-break was silently failing to trigger in this
    setup, causing content past the first page to be written off-canvas
    and invisible. We check remaining vertical space ourselves before every
    write and force a new page when there isn't enough room left.
    """
    bottom_margin = 15
    if pdf.get_y() + needed > (pdf.h - bottom_margin):
        pdf.add_page()


def _safe_write(pdf: FPDF, text: str, line_height: float = 6):
    """
    multi_cell(0, ...) computes its width from the current x position to
    the right margin. After the first call, fpdf2 was leaving x parked
    near the right edge instead of resetting to the left margin, so every
    write after the first one had ~0 width available and raised
    "Not enough horizontal space to render a single character" -- silently
    swallowed by the except block, which is why only item 1 ever appeared.
    Explicitly resetting x to the left margin before each call fixes this.
    """
    if not text:
        return
    est_height = _estimate_lines(pdf, text, pdf.epw) * line_height
    _ensure_space(pdf, est_height)
    pdf.set_x(pdf.l_margin)
    try:
        pdf.multi_cell(0, line_height, text, new_x="LMARGIN", new_y="NEXT")
    except FPDFException:
        chunk_size = 40
        for i in range(0, len(text), chunk_size):
            chunk = text[i:i + chunk_size]
            _ensure_space(pdf, _estimate_lines(pdf, chunk, pdf.epw) * line_height)
            pdf.set_x(pdf.l_margin)
            try:
                pdf.multi_cell(0, line_height, chunk, new_x="LMARGIN", new_y="NEXT")
            except FPDFException:
                continue


def _to_pdf(summary: Summary) -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=False)  # we're handling page breaks manually now

    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Document Summary", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 13)
    _ensure_space(pdf)
    pdf.cell(0, 8, "Executive Summary", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    _safe_write(pdf, _sanitize_for_pdf(summary.executive_summary or ""))
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 13)
    _ensure_space(pdf)
    pdf.cell(0, 8, "Key Takeaways", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    for item in (summary.key_takeaways or []):
        _safe_write(pdf, _sanitize_for_pdf(f"- {item}"))
    pdf.ln(4)


    pdf.set_font("Helvetica", "B", 13)
    _ensure_space(pdf)
    pdf.cell(0, 8, "Risks & Action Items", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    if summary.risks_actions:
        for item in summary.risks_actions:
            label = item.get("type", "note").upper()
            _safe_write(
                pdf,
                _sanitize_for_pdf(f"[{label}] {item.get('description', '')} (Page {item.get('page_num', '?')})"),
            )
    else:
        _safe_write(pdf, "No risks or action items identified.")

    return bytes(pdf.output())


@router.post("/{doc_id}/summary")
def create_summary(db: Session = Depends(get_db), document: Document = Depends(get_owned_document)):
    if document.status != DocumentStatus.READY:
        raise HTTPException(400, f"Document is not ready for summarization yet (status: {document.status}).")

    summary = generate_summary(document.id, db)
    if summary.status == "failed":
        raise HTTPException(500, f"Summary generation failed: {summary.error_message}")

    return _serialize(summary)


@router.get("/{doc_id}/summary")
def get_summary(db: Session = Depends(get_db), document: Document = Depends(get_owned_document)):
    summary = db.query(Summary).filter(Summary.document_id == document.id).first()
    if not summary:
        raise HTTPException(404, "No summary generated yet for this document.")
    return _serialize(summary)


@router.get("/{doc_id}/summary/export")
def export_summary(
    format: str = "markdown",
    db: Session = Depends(get_db),
    document: Document = Depends(get_owned_document),
):
    summary = db.query(Summary).filter(Summary.document_id == document.id).first()
    if not summary or summary.status != "ready":
        raise HTTPException(404, "No completed summary available to export.")

    if format == "markdown":
        markdown = _to_markdown(summary)
        return Response(
            content=markdown,
            media_type="text/markdown",
            headers={"Content-Disposition": f'attachment; filename="summary_{document.id}.md"'},
        )
    elif format == "clipboard":
        markdown = _to_markdown(summary)
        return Response(content=markdown, media_type="text/plain")
    elif format == "pdf":
        pdf_bytes = _to_pdf(summary)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="summary_{document.id}.pdf"'},
        )
    else:
        raise HTTPException(400, f"Unsupported format: {format}. Use markdown, clipboard, or pdf.")