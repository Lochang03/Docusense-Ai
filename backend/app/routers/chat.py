"""
FR-03: Conversational RAG Chatbox & Grounded Verification endpoint.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.document import Document, DocumentStatus
from app.models.chat_message import ChatMessage
from app.auth import get_owned_document
from app.ingestion.retriever import retrieve, is_grounded_enough
from app.ingestion.generator import generate_answer, NOT_IN_DOCUMENT_MESSAGE
from app.models.user import User
from app.auth import get_current_user, get_owned_document

router = APIRouter(prefix="/documents", tags=["chat"])
@router.get("/chat/history")
def get_all_chat_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Every chat message across every document this user owns, most recent
    first — this is the "all my past questions" view, distinct from
    /{doc_id}/chat/history which is scoped to one document.
    """
    messages = (
        db.query(ChatMessage)
        .join(Document, ChatMessage.doc_id == Document.id)
        .filter(Document.owner_id == current_user.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(300)  # a sane cap; this is a history feed, not a full export
        .all()
    )
    return [
        {
            "id": m.id,
            "doc_id": m.doc_id,
            "document_title": m.document.title,
            "role": m.role,
            "content": m.content,
            "citations": m.citations_json,
            "created_at": m.created_at,
        }
        for m in messages
    ]


class ChatRequest(BaseModel):
    question: str


@router.post("/{doc_id}/chat")
def chat_with_document(
    request: ChatRequest,
    db: Session = Depends(get_db),
    document: Document = Depends(get_owned_document),
):
    if document.status != DocumentStatus.READY:
        raise HTTPException(400, f"Document is not ready for chat yet (status: {document.status}).")

    # --- Save the user's question immediately ---
    user_msg = ChatMessage(doc_id=document.id, role="user", content=request.question)
    db.add(user_msg)
    db.commit()

    # --- Retrieve relevant chunks ---
    chunks = retrieve(request.question, doc_id=document.id, db=db)

    # --- FR-03.3: Hallucination mitigation ---
    if not is_grounded_enough(chunks):
        ai_msg = ChatMessage(
            doc_id=document.id,
            role="ai",
            content=NOT_IN_DOCUMENT_MESSAGE,
            citations_json=[],
        )
        db.add(ai_msg)
        db.commit()
        return {"answer": NOT_IN_DOCUMENT_MESSAGE, "citations": []}

    # --- Generate a grounded, cited answer ---
    result = generate_answer(request.question, chunks)

    # --- Save the AI's answer ---
    ai_msg = ChatMessage(
        doc_id=document.id,
        role="ai",
        content=result["answer"],
        citations_json=result["citations"],
    )
    db.add(ai_msg)
    db.commit()

    return result


@router.get("/{doc_id}/chat/history")
def get_chat_history(db: Session = Depends(get_db), document: Document = Depends(get_owned_document)):
    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.doc_id == document.id)
        .order_by(ChatMessage.created_at.asc())
        .all()
    )
    return [
        {
            "role": m.role,
            "content": m.content,
            "citations": m.citations_json,
            "created_at": m.created_at,
        }
        for m in messages
    ]
