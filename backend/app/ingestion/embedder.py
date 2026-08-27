"""
Embedding generation + FAISS index management.

We keep ONE global FAISS index on disk for the whole system (all documents
share it), and disambiguate results by document via the `doc_id` stored
alongside each chunk in SQLite.

The embedding model loads once at import time (module-level singleton) so
we don't reload it on every request.
"""
import threading

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

from app.config import settings

_model_lock = threading.Lock()
_model: SentenceTransformer | None = None

_index_lock = threading.Lock()
_index: faiss.Index | None = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                _model = SentenceTransformer(settings.EMBEDDING_MODEL_NAME)
    return _model


def get_index() -> faiss.Index:
    global _index
    if _index is None:
        with _index_lock:
            if _index is None:
                index_file = str(settings.FAISS_INDEX_PATH)
                try:
                    _index = faiss.read_index(index_file)
                except RuntimeError:
                    base = faiss.IndexFlatIP(settings.EMBEDDING_DIM)
                    _index = faiss.IndexIDMap(base)
    return _index


def save_index():
    faiss.write_index(get_index(), str(settings.FAISS_INDEX_PATH))


def embed_texts(texts: list[str]) -> np.ndarray:
    """Embed a batch of texts, L2-normalized so inner product == cosine similarity."""
    model = get_model()
    vectors = model.encode(texts, convert_to_numpy=True, show_progress_bar=False)
    faiss.normalize_L2(vectors)
    return vectors.astype("float32")


def add_chunks_to_index(faiss_ids: list[int], texts: list[str]):
    """Embed a batch of chunk texts and add them to the FAISS index under given ids."""
    vectors = embed_texts(texts)
    ids = np.array(faiss_ids, dtype="int64")
    index = get_index()
    index.add_with_ids(vectors, ids)
    save_index()


def search(query: str, top_k: int = None) -> list[tuple[int, float]]:
    """Embed a query and search the FAISS index. Returns (faiss_id, similarity_score) tuples."""
    top_k = top_k or settings.TOP_K_CHUNKS
    query_vec = embed_texts([query])
    index = get_index()
    if index.ntotal == 0:
        return []
    scores, ids = index.search(query_vec, min(top_k, index.ntotal))
    results = [
        (int(idx), float(score))
        for idx, score in zip(ids[0], scores[0])
        if idx != -1
    ]
    return results