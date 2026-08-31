"""
Embedding generation + FAISS index management.

Uses Gemini's embedding API (genai.embed_content) instead of a locally-run
model — this offloads the actual computation to Google's servers instead
of Render's very limited free-tier CPU (0.1 vCPU), which was making even
plain-text document embedding painfully slow.
"""
import threading

import faiss
import numpy as np
import google.generativeai as genai

from app.config import settings

genai.configure(api_key=settings.GEMINI_API_KEY, transport="rest")

EMBEDDING_MODEL = "models/gemini-embedding-001"

_index_lock = threading.Lock()
_index: faiss.Index | None = None


def get_index() -> faiss.Index:
    global _index
    if _index is None:
        with _index_lock:
            if _index is None:
                index_file = str(settings.FAISS_INDEX_PATH)
                try:
                    _index = faiss.read_index(index_file)
                    if _index.d != settings.EMBEDDING_DIM:
                        base = faiss.IndexFlatIP(settings.EMBEDDING_DIM)
                        _index = faiss.IndexIDMap(base)
                except RuntimeError:
                    base = faiss.IndexFlatIP(settings.EMBEDDING_DIM)
                    _index = faiss.IndexIDMap(base)
    return _index


def save_index():
    faiss.write_index(get_index(), str(settings.FAISS_INDEX_PATH))


def _embed_batch(texts: list[str], task_type: str) -> np.ndarray:
    all_vectors = []
    batch_size = 100
    for i in range(0, len(texts), batch_size):
        batch = texts[i:i + batch_size]
        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=batch,
            task_type=task_type,
            output_dimensionality=settings.EMBEDDING_DIM,
        )
        all_vectors.extend(result["embedding"])
    vectors = np.array(all_vectors, dtype="float32")
    faiss.normalize_L2(vectors)
    return vectors


def add_chunks_to_index(faiss_ids: list[int], texts: list[str]):
    vectors = _embed_batch(texts, task_type="RETRIEVAL_DOCUMENT")
    ids = np.array(faiss_ids, dtype="int64")
    index = get_index()
    index.add_with_ids(vectors, ids)
    save_index()


def search(query: str, top_k: int = None) -> list[tuple[int, float]]:
    top_k = top_k or settings.TOP_K_CHUNKS
    query_vec = _embed_batch([query], task_type="RETRIEVAL_QUERY")
    index = get_index()
    if index.ntotal == 0:
        return []
    scores, ids = index.search(query_vec, min(top_k, index.ntotal))
    return [(int(idx), float(score)) for idx, score in zip(ids[0], scores[0]) if idx != -1]
