from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

# ─── Environment Variables ────────────────────────────────────────────────────
# load_dotenv() .env file padhta hai aur sab variables os.environ mein daal deta hai.
# Yeh SABSE PEHLE call hona chahiye — neeche ke imports (ChatGroq etc.)
# GROQ_API_KEY environment variable se directly uthate hain module load hote waqt.
load_dotenv()

# ─── Router Imports ───────────────────────────────────────────────────────────
# Har router file apne prefix ke saath aa raha hai:
#   upload_router → /upload/
#   ingest_router → /ingest/
#   chat_router   → /chat/
from routers.upload import router as upload_router
from routers.ingest import router as ingest_router
from routers.chat import router as chat_router


# ─── Lifespan ─────────────────────────────────────────────────────────────────
# @asynccontextmanager se yeh function ek async context manager ban jaata hai.
# FastAPI isko app start aur stop pe automatically call karta hai.
#
# yield se pehle  = startup code  (server accept karna shuru karne se pehle)
# yield ke baad   = shutdown code (server band hone ke baad cleanup)
@asynccontextmanager
async def lifespan(app: FastAPI):

    # ── Startup ───────────────────────────────────────────────────────────────
    print("\n" + "="*50)
    print("  DocuMind API Starting...")
    print("="*50)

    # Environment check — agar GROQ_API_KEY nahi hai toh chat kaam nahi karega
    groq_key = os.getenv("GROQ_API_KEY")
    if groq_key:
        # Key ka sirf pehla aur aakhri 4 chars print karo — security ke liye
        masked = f"{groq_key[:4]}...{groq_key[-4:]}"
        print(f"  ✓ GROQ_API_KEY: {masked}")
    else:
        print("  ✗ GROQ_API_KEY: NOT SET — /chat/ endpoint kaam nahi karega!")

    # ChromaDB path confirm karo
    from services.vector_service import CHROMA_PATH
    print(f"  ✓ ChromaDB path: {CHROMA_PATH}")

    # Uploads directory confirm karo
    uploads_path = os.path.abspath(
        os.path.join(os.path.dirname(__file__), "uploads")
    )
    print(f"  ✓ Uploads dir:  {uploads_path}")
    print("="*50)
    print("  Docs available at: http://localhost:8000/docs")
    print("="*50 + "\n")

    yield  # ← App yahan run karta hai, requests accept karta hai

    # ── Shutdown ──────────────────────────────────────────────────────────────
    print("\nDocuMind API band ho raha hai... Bye!")


# ─── FastAPI App Instance ─────────────────────────────────────────────────────
app = FastAPI(
    title="DocuMind API",
    description="""
## AI Document Chat API

PDF upload karo, ingest karo, aur natural language mein sawal poochho.

### Workflow:
1. **POST /upload/** — PDF upload karo → `doc_id` milega
2. **POST /ingest/** — `doc_id` bhejo → chunking + embedding hoga
3. **POST /chat/**   — `doc_id` + question bhejo → answer milega

### Behind the scenes:
- **ChromaDB** — vector storage
- **Sentence Transformers** — embeddings (all-MiniLM-L6-v2)
- **Groq + LLaMA 3.3 70B** — answer generation
    """,
    version="1.0.0",
    lifespan=lifespan
)


# ─── CORS Middleware ───────────────────────────────────────────────────────────
# React frontend (localhost:5173) alag origin pe hai — browser block karta hai
# by default. Yeh middleware un requests ko allow karta hai.
# Production mein: allow_origins mein apna actual domain daalein.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Register All Routers ─────────────────────────────────────────────────────
# include_router() each router ke endpoints ko main app mein merge kar deta hai.
# Routing table ban jaati hai:
#   POST /upload/            → upload.py
#   POST /ingest/            → ingest.py
#   GET  /ingest/status/{id} → ingest.py
#   POST /chat/              → chat.py
#   GET  /chat/quick         → chat.py
app.include_router(upload_router)
app.include_router(ingest_router)
app.include_router(chat_router)


# ─── Health Check ─────────────────────────────────────────────────────────────
@app.get("/health", tags=["System"])
def health_check():
    """
    Server aur services ki health check.
    Frontend startup pe yeh call kare — sab ready hai ya nahi confirm karne ke liye.
    """
    # ChromaDB accessible hai check karo
    try:
        from services.vector_service import chroma_client
        chroma_client.list_collections()   # Dummy call — agar fail ho toh ChromaDB down hai
        chroma_status = "ok"
    except Exception as e:
        chroma_status = f"error: {str(e)}"

    return {
        "status": "ok",
        "version": "1.0.0",
        "services": {
            "groq_api": "configured" if os.getenv("GROQ_API_KEY") else "missing",
            "chromadb": chroma_status,
            "embedding_model": "all-MiniLM-L6-v2"
        }
    }


# ─── Root ─────────────────────────────────────────────────────────────────────
@app.get("/", tags=["System"])
def root():
    """
    API ka quick overview.
    /docs pe jaao full interactive documentation ke liye.
    """
    return {
        "app": "DocuMind",
        "version": "1.0.0",
        "description": "Chat with your PDF documents using AI",
        "workflow": [
            "1. POST /upload/  — PDF upload karo",
            "2. POST /ingest/  — Document process karo",
            "3. POST /chat/    — Question poochho"
        ],
        "docs": "http://localhost:8000/docs"
    }
