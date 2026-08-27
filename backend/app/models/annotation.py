import uuid
from datetime import datetime

from sqlalchemy import String, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Annotation(Base):
    """A user highlight + the AI's scoped answer about it (feature 3.5)."""
    __tablename__ = "annotations"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    doc_id: Mapped[str] = mapped_column(String, ForeignKey("documents.id"), nullable=False)
    page_num: Mapped[int] = mapped_column(Integer, nullable=False)
    rect_coords: Mapped[dict] = mapped_column(JSON, nullable=True)
    selected_text: Mapped[str] = mapped_column(String, nullable=False)
    ai_notes: Mapped[str] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    document = relationship("Document", back_populates="annotations")
    