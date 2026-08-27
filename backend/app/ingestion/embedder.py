"""
Embedding generation + FAISS index management.

Uses fastembed (ONNX-based) instead of sentence-transformers/PyTorch — the
same underlying BAAI/bge-small-en-v1.5 model, but without pulling in the
full PyTorch runtime, which was pushing memory usage past what Render's
free tier (512MB) allows and causing OOM crashes during ingestion.
"""
import threading

import faiss
import numpy as np
from fastembed import TextEmbedding

from app.config import settings

_model_lock = threading.Lock()
_model: TextEmbedding | None = None

_index_lock = threading.Lock()
_index: faiss.Index | None = None


def get_model() -> TextEmbedding:
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                _model = TextEmbedding(model_name=settings.EMBEDDING_MODEL_NAME)
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
    vectors = np.array(list(model.embed(texts)), dtype="float32")
    faiss.normalize_L2(vectors)
    return vectors


def add_chunks_to_index(faiss_ids: list[int], texts: list[str]):
    vectors = embed_texts(texts)
    ids = np.array(faiss_ids, dtype="int64")
    index = get_index()
    index.add_with_ids(vectors, ids)
    save_index()


def search(query: str, top_k: int = None) -> list[tuple[int, float]]:
    top_k = top_k or settings.TOP_K_CHUNKS
    query_vec = embed_texts([query])
    index = get_index()
    if index.ntotal == 0:
        return []
    scores, ids = index.search(query_vec, min(top_k, index.ntotal))
    return [(int(idx), float(score)) for idx, score in zip(ids[0], scores[0]) if idx != -1]
