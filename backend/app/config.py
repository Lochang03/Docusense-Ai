from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # --- Paths ---
    BASE_DIR: Path = Path(__file__).resolve().parent.parent
    UPLOAD_DIR: Path = BASE_DIR / "uploads"
    STORAGE_DIR: Path = BASE_DIR / "storage"
    SQLITE_DB_PATH: Path = BASE_DIR / "storage" / "docusense.db"
    FAISS_INDEX_PATH: Path = BASE_DIR / "storage" / "faiss_index"

    # --- Database ---
    DATABASE_URL: str = ""  # set via .env — Postgres connection string for production

    # --- Upload limits ---
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_MIME_TYPES: tuple = (
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
        "text/plain",
        "image/png",
        "image/jpeg",
    )

    # --- Chunking ---
    CHUNK_SIZE_TOKENS: int = 800       # within the 512-1024 spec range
    CHUNK_OVERLAP_TOKENS: int = 80     # ~10% overlap

    # --- OCR fallback ---
    # A page is treated as already having a usable text layer if direct
    # extraction yields at least this many characters. Only pages that fall
    # below this bar get rasterized and sent to Tesseract.
    OCR_MIN_CHARS_PER_PAGE: int = 100
    # Rasterization DPI for OCR. 200 is plenty for Tesseract on clean pages and
    # uses well under half the memory of 300 DPI, which matters on a 512MB box.
    OCR_DPI: int = 200
    # Set False to disable OCR entirely. Pages with no text layer then yield no
    # text instead of failing the upload.
    OCR_ENABLED: bool = True

    # --- Embeddings ---
    EMBEDDING_MODEL_NAME: str = "BAAI/bge-small-en-v1.5"  # small + fast
    EMBEDDING_DIM: int = 384  # matches bge-small

    # --- Retrieval ---
    TOP_K_CHUNKS: int = 5
    MIN_SIMILARITY_SCORE: float = 0.35  # below this, trigger "not in document" fallback

    # --- LLM (Gemini) ---
    GEMINI_MODEL: str = "gemini-flash-latest"
    GEMINI_API_KEY: str = ""  # set via .env, never hardcode

    # --- Auth ---
    JWT_SECRET: str = ""  # set via .env, never hardcode

    class Config:
        env_file = ".env"


settings = Settings()

# Ensure required directories exist on import
settings.UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)