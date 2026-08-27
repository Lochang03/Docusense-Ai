from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import init_db, SessionLocal
from app.ingestion.pipeline import initialize_faiss_id_counter
from app.routers import documents, chat, summary, annotations, auth

app = FastAPI(title="DocuSense AI", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(chat.router)
app.include_router(summary.router)
app.include_router(annotations.router)
app.include_router(auth.router)


@app.on_event("startup")
def on_startup():
    init_db()
    db = SessionLocal()
    try:
        initialize_faiss_id_counter(db)
    finally:
        db.close()


@app.get("/health")
def health_check():
    return {"status": "ok"}