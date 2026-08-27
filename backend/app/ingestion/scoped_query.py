"""
FR-05.1/05.2: Selection Highlighting & Contextual "Ask AI".

Unlike chat, there's no retrieval step here — the user has already picked
the exact text they want the model to reason about. We just pass that
selection straight to Gemini with a mode-specific instruction.
"""
import google.generativeai as genai

from app.config import settings

genai.configure(api_key=settings.GEMINI_API_KEY)
_model = genai.GenerativeModel(settings.GEMINI_MODEL)

MODE_INSTRUCTIONS = {
    "explain": "Explain the following passage in simple, plain language a non-expert could understand. Keep it concise.",
    "summarize": "Summarize the following passage in 2-3 sentences, capturing only the essential point.",
    "risks": "Identify any risks, obligations, deadlines, or liabilities present in the following passage. If none exist, say so plainly.",
}


def _build_prompt(selected_text: str, mode: str, custom_question: str | None) -> str:
    if mode == "custom":
        instruction = custom_question or "Answer a question about the following passage."
    else:
        instruction = MODE_INSTRUCTIONS.get(mode, MODE_INSTRUCTIONS["explain"])

    return f"""You are a document analysis assistant. A user has highlighted the passage below from a document and wants help with it.

STRICT RULES:
1. Base your answer ONLY on the passage below. Do not use outside knowledge beyond what's needed to explain terms.
2. Be concise and direct.

HIGHLIGHTED PASSAGE:
{selected_text}

TASK:
{instruction}

ANSWER:"""


def answer_scoped_query(selected_text: str, mode: str, custom_question: str | None = None) -> str:
    prompt = _build_prompt(selected_text, mode, custom_question)
    response = _model.generate_content(prompt)
    return response.text