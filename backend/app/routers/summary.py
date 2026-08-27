"""
FR-04: Multi-Mode Document Summarization endpoints.
FR-04.1/04.2: generate + fetch the executive summary, key takeaways, risks/actions.
FR-04.3: export the summary as Markdown, PDF, or plain text (for clipboard).
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import Response
from fpdf import FPDF
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


def _to_pdf(summary: Summary) -> bytes:
    pdf = FPDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Document Summary", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, "Executive Summary", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    pdf.multi_cell(0, 6, summary.executive_summary or "")
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, "Key Takeaways", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    for item in (summary.key_takeaways or []):
        pdf.multi_cell(0, 6, f"- {item}")
    pdf.ln(4)

    pdf.set_font("Helvetica", "B", 13)
    pdf.cell(0, 8, "Risks & Action Items", new_x="LMARGIN", new_y="NEXT")
    pdf.set_font("Helvetica", "", 11)
    if summary.risks_actions:
        for item in summary.risks_actions:
            label = item.get("type", "note").upper()
            pdf.multi_cell(
                0, 6, f"[{label}] {item.get('description', '')} (Page {item.get('page_num', '?')})"
            )
    else:
        pdf.multi_cell(0, 6, "No risks or action items identified.")

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
