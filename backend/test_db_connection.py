import time
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv()
db_url = os.environ.get('DATABASE_URL')
print('Connecting to:', db_url[:40] + '...' if db_url else 'NOT SET')

start = time.time()
engine = create_engine(db_url)
with engine.connect() as conn:
    result = conn.execute(text('SELECT 1'))
    print('Query result:', result.scalar())
print(f'Took {time.time() - start:.2f} seconds')
