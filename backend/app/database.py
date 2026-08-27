from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from app.config import settings

# Prefer a real Postgres DATABASE_URL (production/Supabase) when set,
# otherwise fall back to the local SQLite file (local dev without .env).
db_url = settings.DATABASE_URL or f"sqlite:///{settings.SQLITE_DB_PATH}"
connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}

engine = create_engine(db_url, connect_args=connect_args)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    """FastAPI dependency — yields a session and guarantees it closes."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Called once on app startup."""
    from app.models import document, chunk, chat_message, annotation, summary, user  # noqa: F401
    Base.metadata.create_all(bind=engine)