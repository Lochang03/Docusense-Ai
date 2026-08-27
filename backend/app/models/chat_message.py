import uuid
from datetime import datetime

from sqlalchemy import String, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class ChatMessage(Base):
    """A single turn (user question or AI answer) in a document's chat thread."""
    __tablename__ = "chat_messages"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    doc_id: Mapped[str] = mapped_column(String, ForeignKey("documents.id"), nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)  # "user" | "ai"
    content: Mapped[str] = mapped_column(String, nullable=False)
    citations_json: Mapped[list] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="chat_messages")