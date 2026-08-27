"""
Orchestrates the full ingestion flow for one document:
  extract -> chunk -> embed -> persist

Designed to run as a FastAPI BackgroundTask so the upload endpoint returns
immediately and the client polls `/documents/{id}/status` for progress.
"""
import itertools

from sqlalchemy.orm import Session

from app.models.document import Document, DocumentStatus
from app.models.chunk import DocumentChunk
from app.ingestion.extractor import extract
from app.ingestion.chunker import chunk_document
from app.ingestion.embedder import add_chunks_to_index

# In-process counter to hand out unique FAISS ids across documents.
_faiss_id_counter = itertools.count(start=1)


def initialize_faiss_id_counter(db: Session):
    """
    Call once at app startup. Resumes numbering from the highest existing
    faiss_id in the DB, so a server restart doesn't hand out ids that
    collide with chunks already embedded in the FAISS index.
    """
    global _faiss_id_counter
    max_id = db.query(DocumentChunk.faiss_id).order_by(DocumentChunk.faiss_id.desc()).first()
    start = (max_id[0] + 1) if max_id else 1
    _faiss_id_counter = itertools.count(start=start)


def run_ingestion(doc_id: str, file_path: str, mime_type: str, db: Session):
    """
    Runs synchronously inside a background task. Updates the Document's
    status as it progresses so the frontend can show a live progress state.
    """
    document = db.query(Document).filter(Document.id == doc_id).first()
    if not document:
        return

    try:
        # --- Step 1: Extraction ---
        document.status = DocumentStatus.EXTRACTING
        db.commit()
        pages = extract(file_path, mime_type)
        document.page_count = len(pages)
        db.commit()

        # --- Step 2: Chunking ---
        document.status = DocumentStatus.CHUNKING
        db.commit()
        chunks = chunk_document(doc_id, pages)

        if not chunks:
            document.status = DocumentStatus.FAILED
            document.error_message = "No extractable text found in document."
            db.commit()
            return

        # --- Step 3: Persist chunk rows + assign faiss ids ---
        db_chunks = []
        for c in chunks:
            faiss_id = next(_faiss_id_counter)
            db_chunk = DocumentChunk(
                doc_id=doc_id,
                faiss_id=faiss_id,
                page_num=c.page_num,
                bbox_json=c.bbox,
                content=c.content,
            )
            db_chunks.append(db_chunk)
        db.add_all(db_chunks)
        db.commit()

        # --- Step 4: Embedding ---
        document.status = DocumentStatus.EMBEDDING
        db.commit()
        add_chunks_to_index(
            faiss_ids=[c.faiss_id for c in db_chunks],
            texts=[c.content for c in db_chunks],
        )

        # --- Done ---
        document.status = DocumentStatus.READY
        db.commit()

    except Exception as e:
        document.status = DocumentStatus.FAILED
        document.error_message = str(e)
        db.commit()
        raise