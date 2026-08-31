"""
FR-03.1 / FR-03.2 / FR-03.3: Grounded generation with citations.

Takes retrieved chunks + a user question, builds a strict prompt, and calls
Gemini. The prompt is the single most important piece of engineering in
this whole feature — it's what stops the model from just answering from its
own general knowledge instead of the document.
"""
import google.generativeai as genai

from app.config import settings
from app.ingestion.retriever import RetrievedChunk

genai.configure(api_key=settings.GEMINI_API_KEY, transport="rest")
_model = genai.GenerativeModel(settings.GEMINI_MODEL)


NOT_IN_DOCUMENT_MESSAGE = (
    "This document doesn't appear to contain information relevant to your question."
)


def _build_context_block(chunks: list[RetrievedChunk]) -> str:
    """
    Formats retrieved chunks into a labeled context block, so the model can
    reference exact page numbers when it answers.
    """
    parts = []
    for c in chunks:
        parts.append(f"[Page {c.page_num}]\n{c.content}")
    return "\n\n---\n\n".join(parts)


def _build_prompt(question: str, chunks: list[RetrievedChunk]) -> str:
    context = _build_context_block(chunks)
    return f"""You are a document analysis assistant. Answer the user's question using ONLY the context provided below, which was extracted from a specific document.

STRICT RULES:
1. Only use information found in the CONTEXT section below. Do not use any outside knowledge.
2. Every factual claim in your answer must be traceable to the context.
3. After each claim, cite the page it came from in this exact format: [Page X]
4. If the context does not contain enough information to answer the question, say so plainly instead of guessing.
5. Be concise and direct.

CONTEXT:
{context}

QUESTION:
{question}

ANSWER:"""


def generate_answer(question: str, chunks: list[RetrievedChunk]) -> dict:
    """
    Calls Gemini with the grounded prompt and returns the answer text plus
    structured citation data (page numbers + chunk ids actually used).
    """
    prompt = _build_prompt(question, chunks)
    response = _model.generate_content(prompt, request_options={"timeout": 60})

    citations = [
        {"page": c.page_num, "chunk_id": c.chunk_id, "score": round(c.score, 3)}
        for c in chunks
    ]

    return {
        "answer": response.text,
        "citations": citations,
    }