"""
FR-05: Selection Highlighting & Contextual "Ask AI" endpoints.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.document import Document, DocumentStatus
from app.models.annotation import Annotation
from app.auth import get_owned_document
from app.ingestion.scoped_query import answer_scoped_query

router = APIRouter(prefix="/documents", tags=["annotations"])


class AnnotationRequest(BaseModel):
    selected_text: str
    page_num: int
    mode: str
    custom_question: str | None = None
    rect_coords: dict | None = None


def _serialize(a: Annotation) -> dict:
    return {
        "id": a.id,
        "doc_id": a.doc_id,
        "page_num": a.page_num,
        "selected_text": a.selected_text,
        "ai_notes": a.ai_notes,
        "rect_coords": a.rect_coords,
        "created_at": a.created_at,
    }


@router.post("/{doc_id}/annotations")
def create_annotation(
    request: AnnotationRequest,
    db: Session = Depends(get_db),
    document: Document = Depends(get_owned_document),
):
    if document.status != DocumentStatus.READY:
        raise HTTPException(400, f"Document is not ready yet (status: {document.status}).")

    if not request.selected_text.strip():
        raise HTTPException(400, "No text was selected.")

    try:
        answer = answer_scoped_query(request.selected_text, request.mode, request.custom_question)
    except Exception as e:
        raise HTTPException(500, f"Scoped query failed: {e}")

    annotation = Annotation(
        doc_id=document.id,
        page_num=request.page_num,
        rect_coords=request.rect_coords,
        selected_text=request.selected_text,
        ai_notes=answer,
    )
    db.add(annotation)
    db.commit()
    db.refresh(annotation)

    return _serialize(annotation)


@router.get("/{doc_id}/annotations")
def list_annotations(db: Session = Depends(get_db), document: Document = Depends(get_owned_document)):
    annotations = (
        db.query(Annotation)
        .filter(Annotation.doc_id == document.id)
        .order_by(Annotation.created_at.desc())
        .all()
    )
    return [_serialize(a) for a in annotations]
