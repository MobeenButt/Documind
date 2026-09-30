import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.pdf_service import extract_text_from_pdf
from services.vector_service import ingest_document, document_exists

# ─── Router Setup ─────────────────────────────────────────────────────────────
router = APIRouter(prefix="/ingest", tags=["Ingest"])

# ─── Upload Directory ─────────────────────────────────────────────────────────
# Upload router mein yahi path use kiya tha — same reconstruct karo
# Yeh DRY (Don't Repeat Yourself) principle ka thoda violation hai —
# Phase ke end mein config file mein move kar sakte hain
UPLOAD_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "uploads")
)


# ─── Request Body Schema ──────────────────────────────────────────────────────
# Pydantic BaseModel request body define karta hai.
# FastAPI automatically:
#   - JSON parse karega
#   - Type validate karega (doc_id string hai?)
#   - Missing fields pe 422 Unprocessable Entity dega
class IngestRequest(BaseModel):
    doc_id: str  # Upload endpoint ne jo doc_id return kiya tha


# ─── Ingest Endpoint ──────────────────────────────────────────────────────────
@router.post("/")
async def ingest_pdf(request: IngestRequest):
    """
    Uploaded PDF ko process karo:
    1. Text extract karo
    2. Chunks banao
    3. Embeddings generate karo
    4. ChromaDB mein store karo

    Yeh endpoint upload ke baad call karna hoga.
    doc_id upload response se milta hai.

    Note: Yeh operation slow ho sakta hai badi PDFs ke liye (10-30 sec).
    """

    doc_id = request.doc_id

    # ── Step 1: PDF File Dhundo ───────────────────────────────────────────────
    # Upload ke waqt humne {doc_id}.pdf naam se save kiya tha
    pdf_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")

    # File exist nahi karti? Matlab ya toh upload nahi hua ya wrong doc_id hai
    if not os.path.exists(pdf_path):
        raise HTTPException(
            status_code=404,  # 404 = Not Found
            detail=f"PDF nahi mili doc_id '{doc_id}' ke liye. Pehle /upload karein."
        )

    # ── Step 2: Duplicate Check ───────────────────────────────────────────────
    # Agar document pehle se ChromaDB mein hai toh dobara ingest karna wasteful hai
    # document_exists() ChromaDB mein collection check karta hai
    if document_exists(doc_id):
        raise HTTPException(
            status_code=409,  # 409 = Conflict — resource already exists
            detail=f"Document '{doc_id}' pehle se ingest hua hua hai. Chat kar sakte hain ab."
        )

    # ── Step 3: Text Extract ──────────────────────────────────────────────────
    # pdf_service se pages extract karo
    # [{"page_number": 1, "text": "..."}, ...]
    try:
        pages_data = extract_text_from_pdf(pdf_path)
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"PDF text extract karne mein error: {str(e)}"
        )

    # Agar koi bhi page extract nahi hua (sab blank ya images)
    if not pages_data:
        raise HTTPException(
            status_code=422,
            detail="PDF mein koi readable text nahi mila. Scanned image PDF hai?"
        )

    # ── Step 4: Ingest (Chunk + Embed + Store) ────────────────────────────────
    # vector_service ka heavy lifting yahan hota hai
    # Yeh function internally:
    #   - Text splitter se chunks banata hai
    #   - SentenceTransformer se embeddings generate karta hai
    #   - ChromaDB collection mein store karta hai
    try:
        result = ingest_document(doc_id, pages_data)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"ChromaDB mein store karne mein error: {str(e)}"
        )

    # ── Step 5: Response ──────────────────────────────────────────────────────
    return {
        "success": True,
        "doc_id": doc_id,
        "pages_processed": len(pages_data),
        "total_chunks": result["total_chunks"],
        "message": result["message"],
        "next_step": f"Ab /chat/ endpoint use karo doc_id='{doc_id}' ke saath"
    }


# ─── Ingest Status Check ──────────────────────────────────────────────────────
@router.get("/status/{doc_id}")
async def check_ingest_status(doc_id: str):
    """
    Check karo kya document ingest ho chuka hai ya nahi.

    Path parameter use kiya hai — /ingest/status/abc-123
    Query parameter bhi ho sakta tha — /ingest/status?doc_id=abc-123
    Path parameter zyada RESTful convention hai jab kisi specific resource
    ke baare mein puchh rahe ho.
    """
    pdf_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")

    # Dono check karo — PDF bhi exist kare aur ChromaDB mein bhi ho
    pdf_exists = os.path.exists(pdf_path)
    is_ingested = document_exists(doc_id)

    return {
        "doc_id": doc_id,
        "pdf_uploaded": pdf_exists,
        "ingested_in_chromadb": is_ingested,
        "ready_for_chat": pdf_exists and is_ingested
    }
