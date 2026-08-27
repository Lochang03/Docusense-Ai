"""
Retrieval logic for RAG chat (FR-03.1).

embedder.search() only returns (faiss_id, similarity_score) pairs — raw
numbers, no actual text. This file's job is to take those results and join
them back to the real chunk content, page number, and bbox sitting in
SQLite, so we have something actually useful to hand to the LLM.
"""
from dataclasses import dataclass

from sqlalchemy.orm import Session

from app.config import settings
from app.ingestion.embedder import search as faiss_search, get_index
from app.models.chunk import DocumentChunk


@dataclass
class RetrievedChunk:
    chunk_id: int
    page_num: int
    content: str
    bbox: dict | None
    score: float


def retrieve(query: str, doc_id: str, db: Session, top_k: int = None) -> list[RetrievedChunk]:
    """
    Search FAISS for chunks similar to the query, filter to only this
    document's chunks, and join back to real content from SQLite.
    """
    top_k = top_k or settings.TOP_K_CHUNKS

    # FAISS searches across ALL documents in the system (remember, we use
    # one shared index). We search the entire index rather than a small
    # fixed multiplier — with a shared global index, a fixed over-fetch
    # (e.g. top_k * 3) can miss a document's own chunks entirely once
    # enough other documents accumulate in the index. At this project's
    # scale (thousands of chunks, not millions), searching everything is
    # cheap and guarantees this document's chunks are always considered,
    # then we filter down to just this document below.
    total_vectors = get_index().ntotal
    raw_results = faiss_search(query, top_k=max(top_k * 3, total_vectors))

    if not raw_results:
        return []

    faiss_ids = [fid for fid, _ in raw_results]
    score_map = {fid: score for fid, score in raw_results}

    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.faiss_id.in_(faiss_ids))
        .filter(DocumentChunk.doc_id == doc_id)
        .all()
    )

    retrieved = [
        RetrievedChunk(
            chunk_id=c.id,
            page_num=c.page_num,
            content=c.content,
            bbox=c.bbox_json,
            score=score_map[c.faiss_id],
        )
        for c in chunks
    ]

    # Sort by similarity score, best first, and trim to the real top_k
    # (since we over-fetched to account for filtering out other documents).
    retrieved.sort(key=lambda r: r.score, reverse=True)
    return retrieved[:top_k]


def get_ordered_chunks(doc_id: str, db: Session) -> list[RetrievedChunk]:
    """
    Used for summarization (FR-04), not chat retrieval. Unlike retrieve(),
    this pulls EVERY chunk for the document, in page order — because a
    summary needs the whole document, not just chunks relevant to a query.
    Score is meaningless here (no query to score against), so it's fixed at 1.0.
    """
    chunks = (
        db.query(DocumentChunk)
        .filter(DocumentChunk.doc_id == doc_id)
        .order_by(DocumentChunk.page_num, DocumentChunk.id)
        .all()
    )

    return [
        RetrievedChunk(
            chunk_id=c.id,
            page_num=c.page_num,
            content=c.content,
            bbox=c.bbox_json,
            score=1.0,
        )
        for c in chunks
    ]


def is_grounded_enough(chunks: list[RetrievedChunk]) -> bool:
    """
    FR-03.3: Hallucination Mitigation.
    If the best match isn't similar enough, we shouldn't let the LLM guess —
    better to say "not in this document" than invent a plausible-sounding
    but wrong answer.
    """
    if not chunks:
        return False
    return chunks[0].score >= settings.MIN_SIMILARITY_SCORE