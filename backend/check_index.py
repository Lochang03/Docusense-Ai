import faiss
import sqlite3

index = faiss.read_index('storage/faiss_index')
print('FAISS index total vectors:', index.ntotal)

conn = sqlite3.connect('storage/docusense.db')
count = conn.execute('SELECT COUNT(*) FROM document_chunks').fetchone()[0]
print('SQLite chunk rows:', count)
