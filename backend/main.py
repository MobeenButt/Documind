from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

from routers.upload    import router as upload_router
from routers.ingest    import router as ingest_router
from routers.chat      import router as chat_router
from routers.documents import router as documents_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("\n" + "="*50)
    print("  DocuMind API Starting...")
    print("="*50)

    groq_key = os.getenv("GROQ_API_KEY")
    supa_url = os.getenv("SUPABASE_URL")
    supa_key = os.getenv("SUPABASE_SERVICE_KEY")

    print(f"  {'✓' if groq_key  else '✗'} GROQ_API_KEY:      {groq_key[:8] + '...' if groq_key  else 'NOT SET'}")
    print(f"  {'✓' if supa_url  else '✗'} SUPABASE_URL:      {supa_url  or 'NOT SET'}")
    print(f"  {'✓' if supa_key  else '✗'} SUPABASE_KEY:      {'set' if supa_key else 'NOT SET'}")
    print("="*50)
    print("  Docs: http://localhost:8000/docs")
    print("="*50 + "\n")

    yield

    print("\nDocuMind API shutting down...")


app = FastAPI(
    title="DocuMind API",
    description="RAG-powered document chat with Supabase + Groq",
    version="2.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload_router)
app.include_router(ingest_router)
app.include_router(chat_router)
app.include_router(documents_router)


@app.get("/health", tags=["System"])
def health_check():
    try:
        from services.supabase_service import _supabase
        _supabase.table("documents").select("id").limit(1).execute()
        db_status = "ok"
    except Exception as e:
        db_status = f"error: {str(e)}"

    return {
        "status":  "ok",
        "version": "2.0.0",
        "services": {
            "groq_api":       "configured" if os.getenv("GROQ_API_KEY") else "missing",
            "supabase_db":    db_status,
            "embedding_model": "all-MiniLM-L6-v2",
            "vector_store":   "supabase_pgvector",
        }
    }


@app.get("/", tags=["System"])
def root():
    return {
        "app":     "DocuMind",
        "version": "2.0.0",
        "storage": "Supabase (pgvector + Storage)",
        "workflow": [
            "POST /upload/     — PDF upload",
            "POST /ingest/     — Process + embed",
            "POST /chat/       — Ask questions",
            "GET  /documents/  — Document history",
            "GET  /chat/history/{doc_id} — Chat history",
        ],
        "docs": "http://localhost:8000/docs"
    }
