import sqlite3
conn = sqlite3.connect('storage/docusense.db')
conn.execute('ALTER TABLE documents ADD COLUMN owner_id VARCHAR')
conn.commit()
print('done')
