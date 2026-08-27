from sqlalchemy import String, Integer, ForeignKey, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DocumentChunk(Base):
    """
    One semantic chunk of a document (512-1024 tokens, ~10% overlap).
    `faiss_id` is the row index of this chunk's embedding inside the FAISS
    index — that's how we go from a vector search hit back to real text.
    """
    __tablename__ = "document_chunks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    doc_id: Mapped[str] = mapped_column(String, ForeignKey("documents.id"), nullable=False)
    faiss_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=False)
    page_num: Mapped[int] = mapped_column(Integer, nullable=False)
    bbox_json: Mapped[dict] = mapped_column(JSON, nullable=True)
    content: Mapped[str] = mapped_column(String, nullable=False)

    document = relationship("Document", back_populates="chunks")