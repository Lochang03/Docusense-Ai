"""
FR-04.1 / FR-04.2: Multi-mode document summarization.

Pulls the full document (in page order, not similarity order — see
retriever.get_ordered_chunks), builds one prompt asking Gemini for a
structured JSON response, and parses it into the pieces the Summary
model needs: executive summary, key takeaways, and risks/actions.

One call instead of three separate calls (summary / takeaways / risks)
to stay inside the FR-04.1 5-second budget and keep everything grounded
in the same context so the pieces don't contradict each other.
"""
import json

import google.generativeai as genai
from sqlalchemy.orm import Session

from app.config import settings
from app.ingestion.retriever import RetrievedChunk, get_ordered_chunks
from app.models.summary import Summary

genai.configure(api_key=settings.GEMINI_API_KEY, transport="rest")
_model = genai.GenerativeModel(settings.GEMINI_MODEL)

# Rough token safety margin. We approximate 1 token ~= 4 characters, and cap
# context well under Gemini's real limit to leave room for the prompt
# instructions and the response itself.
MAX_CONTEXT_CHARS = 60_000


def _build_context_block(chunks: list[RetrievedChunk]) -> str:
    """
    Same labeled-context style as generator.py, but built from ALL chunks
    in page order. If the document is too long, we keep earlier pages —
    executive content (title, scope, key terms) is almost always
    front-loaded in contracts, reports, and specs.
    """
    parts = []
    total_len = 0

    for c in chunks:
        block = f"[Page {c.page_num}]\n{c.content}"
        if total_len + len(block) > MAX_CONTEXT_CHARS:
            break
        parts.append(block)
        total_len += len(block)

    return "\n\n---\n\n".join(parts)


def _build_prompt(context: str) -> str:
    return f"""You are a document analysis assistant. Read the document context below and produce a structured summary.

STRICT RULES:
1. Only use information found in the CONTEXT section below. Do not use any outside knowledge.
2. Respond with ONLY a single valid JSON object — no markdown formatting, no code fences, no explanation before or after.
3. The JSON object must have exactly these three keys:
   - "executive_summary": a string, 200-300 words, summarizing the document's purpose and main content.
   - "key_takeaways": a list of short strings, each one a distinct key finding, obligation, or metric.
   - "risks_actions": a list of objects, each with "type" (one of "risk", "action", "deadline"), "description" (string), and "page_num" (integer, the page this was found on).
4. If the document contains no risks, actions, or deadlines, return an empty list for "risks_actions".

CONTEXT:
{context}

JSON:"""


def _parse_response(raw_text: str) -> dict:
    """
    Gemini sometimes wraps JSON in ```json fences even when told not to.
    Strip those before parsing.
    """
    text = raw_text.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()

    return json.loads(text)


def generate_summary(doc_id: str, db: Session) -> Summary:
    """
    Orchestrates the full FR-04.1 / FR-04.2 flow: fetch chunks, prompt
    Gemini, parse the result, and persist it to the summaries table.
    Called by the summary router (built next).
    """
    summary_row = db.query(Summary).filter(Summary.document_id == doc_id).first()
    if summary_row is None:
        summary_row = Summary(document_id=doc_id)
        db.add(summary_row)

    summary_row.status = "generating"
    db.commit()

    try:
        chunks = get_ordered_chunks(doc_id, db)
        context = _build_context_block(chunks)
        prompt = _build_prompt(context)

        response = _model.generate_content(prompt)
        parsed = _parse_response(response.text)

        summary_row.executive_summary = parsed["executive_summary"]
        summary_row.key_takeaways = parsed["key_takeaways"]
        summary_row.risks_actions = parsed["risks_actions"]
        summary_row.status = "ready"
        summary_row.error_message = None

    except Exception as e:
        summary_row.status = "failed"
        summary_row.error_message = str(e)

    db.commit()
    db.refresh(summary_row)
    return summary_row
