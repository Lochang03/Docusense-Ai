import sqlite3
from app.models import document, chunk, chat_message, annotation, summary, user
from app.ingestion.embedder import search as faiss_search
from app.models.chunk import DocumentChunk
from app.database import SessionLocal

conn = sqlite3.connect('storage/docusense.db')
doc_id = conn.execute('SELECT id, title FROM documents ORDER BY created_at DESC LIMIT 1').fetchone()
print('Testing against:', doc_id)

raw = faiss_search('what is this document about', top_k=15)
print('Raw FAISS results (faiss_id, score):', raw)

db = SessionLocal()
this_docs_chunks = db.query(DocumentChunk).filter(DocumentChunk.doc_id == doc_id[0]).all()
print('This document has', len(this_docs_chunks), 'chunks in SQLite')
print('Their faiss_ids:', [c.faiss_id for c in this_docs_chunks][:10], '...')
