"""
FR-01.1: Multi-Format Ingestion endpoints.
"""
import uuid
from pathlib import Path

import magic
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks, Depends
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.document import Document, DocumentStatus
from app.models.user import User
from app.auth import get_current_user, get_owned_document
from app.ingestion.pipeline import run_ingestion
from fastapi.responses import FileResponse

router = APIRouter(prefix="/documents", tags=["documents"])


@router.post("/upload")
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    contents = await file.read()
    size_mb = len(contents) / (1024 * 1024)
    if size_mb > settings.MAX_FILE_SIZE_MB:
        raise HTTPException(400, f"File exceeds {settings.MAX_FILE_SIZE_MB}MB limit.")

    detected_mime = magic.from_buffer(contents, mime=True)
    if detected_mime not in settings.ALLOWED_MIME_TYPES:
        raise HTTPException(
            400,
            f"Unsupported or unverified file type: {detected_mime}. "
            f"Allowed: {settings.ALLOWED_MIME_TYPES}",
        )

    doc_id = str(uuid.uuid4())
    ext = Path(file.filename).suffix
    saved_path = settings.UPLOAD_DIR / f"{doc_id}{ext}"
    with open(saved_path, "wb") as f:
        f.write(contents)

    document = Document(
        id=doc_id,
        title=file.filename,
        file_url=str(saved_path),
        mime_type=detected_mime,
        status=DocumentStatus.UPLOADED,
        owner_id=current_user.id,
    )
    db.add(document)
    db.commit()

    background_tasks.add_task(run_ingestion, doc_id, str(saved_path), detected_mime, db)

    return {"id": doc_id, "status": document.status, "message": "Upload received, processing started."}


@router.get("/{doc_id}/status")
def get_status(document: Document = Depends(get_owned_document)):
    return {
        "id": document.id,
        "title": document.title,
        "status": document.status,
        "page_count": document.page_count,
        "error_message": document.error_message,
        "mime_type": document.mime_type,
    }


@router.get("")
def list_documents(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    documents = (
        db.query(Document)
        .filter(Document.owner_id == current_user.id)
        .order_by(Document.created_at.desc())
        .all()
    )
    return [
        {"id": d.id, "title": d.title, "status": d.status, "page_count": d.page_count}
        for d in documents
    ]


@router.get("/{doc_id}/file")
def get_document_file(document: Document = Depends(get_owned_document)):
    return FileResponse(document.file_url, media_type=document.mime_type, filename=document.title)
