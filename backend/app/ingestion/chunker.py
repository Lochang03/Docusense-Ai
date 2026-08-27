"""
FR-01.3: Semantic Chunking.

Splits each page's text into 512-1024 token windows with ~10% overlap, and
carries forward a bounding box for each chunk (union of the word boxes it
contains) so citations can later highlight the right region on the page.

We use a simple whitespace-token approximation rather than a full tokenizer
here — it's close enough for chunk sizing and keeps this dependency-free.
"""
from dataclasses import dataclass

from app.config import settings
from app.ingestion.extractor import PageText


@dataclass
class Chunk:
    doc_id: str
    page_num: int
    content: str
    bbox: dict | None  # {"x0","y0","x1","y1"} union box, or None if unavailable


def _union_bbox(boxes: list[list[float]]) -> dict | None:
    if not boxes:
        return None
    x0 = min(b[0] for b in boxes)
    y0 = min(b[1] for b in boxes)
    x1 = max(b[2] for b in boxes)
    y1 = max(b[3] for b in boxes)
    return {"x0": x0, "y0": y0, "x1": x1, "y1": y1}


def chunk_page(doc_id: str, page: PageText) -> list[Chunk]:
    """Chunk a single page's text into overlapping windows."""
    words = page.text.split()
    if not words:
        return []

    size = settings.CHUNK_SIZE_TOKENS
    overlap = settings.CHUNK_OVERLAP_TOKENS
    step = max(size - overlap, 1)

    chunks: list[Chunk] = []
    i = 0
    while i < len(words):
        window_words = words[i:i + size]
        content = " ".join(window_words)

        bbox = None
        if page.bbox_map:
            relevant = page.bbox_map[i:i + size]
            bbox = _union_bbox([w["bbox"] for w in relevant if "bbox" in w])

        chunks.append(Chunk(doc_id=doc_id, page_num=page.page_num, content=content, bbox=bbox))

        if i + size >= len(words):
            break
        i += step

    return chunks


def chunk_document(doc_id: str, pages: list[PageText]) -> list[Chunk]:
    """Chunk every page of a document and return a flat list of chunks in page order."""
    all_chunks: list[Chunk] = []
    for page in pages:
        all_chunks.extend(chunk_page(doc_id, page))
    return all_chunks