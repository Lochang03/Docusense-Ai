# app/models/summary.py
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from app.database import Base


class Summary(Base):
    __tablename__ = "summaries"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, ForeignKey("documents.id"), nullable=False, unique=True)

    status = Column(String, nullable=False, default="pending")  # pending | generating | ready | failed
    error_message = Column(Text, nullable=True)

    executive_summary = Column(Text, nullable=True)          # 200-300 word summary
    key_takeaways = Column(JSON, nullable=True)               # list[str]
    risks_actions = Column(JSON, nullable=True)               # list[{type, description, page_num}]

    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    document = relationship("Document", back_populates="summary")