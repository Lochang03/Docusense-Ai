import sqlite3
from app.models import document, chunk, chat_message, annotation, summary, user
from app.ingestion.retriever import retrieve
from app.database import SessionLocal

conn = sqlite3.connect('storage/docusense.db')
doc_id = conn.execute('SELECT id, title FROM documents ORDER BY created_at DESC LIMIT 1').fetchone()
print('Testing against:', doc_id)

db = SessionLocal()
chunks = retrieve('what is this document about', doc_id=doc_id[0], db=db)
print('Chunks found:', len(chunks))
for c in chunks[:3]:
    print(f'  score={c.score:.3f} page={c.page_num} preview={c.content[:80]!r}')
