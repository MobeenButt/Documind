from contextlib import asynccontextmanager
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from routers.upload import router as upload_router
from routers.ingest import router as ingest_router
from routers.chat import router as chat_router
from routers.documents import router as documents_router
from routers.auth import router as auth_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n" + "=" * 50)
    print("  DocuMind API starting...")
    print("=" * 50)

    groq_key = os.getenv("GROQ_API_KEY")
    mongo_uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    jwt_set = bool(os.getenv("JWT_SECRET"))

    print(f"  {'✓' if groq_key else '✗'} GROQ_API_KEY:  {groq_key[:8] + '...' if groq_key else 'NOT SET'}")
    print(f"  {'✓' if mongo_uri else '✗'} MONGO_URI:     {mongo_uri}")
    print(f"  {'✓' if jwt_set else '✗'} JWT_SECRET:    {'set' if jwt_set else 'NOT SET'}")
    print("=" * 50)
    print("  Docs: http://localhost:8000/docs")
    print("=" * 50 + "\n")

    yield

    print("\nDocuMind API shutting down...")


app = FastAPI(
    title="DocuMind API",
    description="RAG-powered document chat with MongoDB + Groq",
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(upload_router)
app.include_router(ingest_router)
app.include_router(chat_router)
app.include_router(documents_router)


@app.get("/health", tags=["System"])
def health_check():
    from services.mongo_service import _client

    try:
        _client.admin.command("ping")
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {e}"

    return {
        "status": "ok",
        "version": "3.0.0",
        "services": {
            "groq_api": "configured" if os.getenv("GROQ_API_KEY") else "missing",
            "mongodb": db_status,
            "embedding_model": "all-MiniLM-L6-v2",
            "vector_store": "mongodb_cosine",
        },
    }


@app.get("/", tags=["System"])
def root():
    return {
        "app": "DocuMind",
        "version": "3.0.0",
        "storage": "MongoDB + local filesystem",
        "workflow": [
            "POST /auth/signup   — Create account",
            "POST /auth/login    — Sign in",
            "POST /upload/       — PDF upload",
            "POST /ingest/       — Process + embed",
            "POST /chat/         — Ask questions",
            "GET  /documents/    — Document history",
            "GET  /chat/history/{doc_id} — Chat history",
        ],
        "docs": "http://localhost:8000/docs",
    }
