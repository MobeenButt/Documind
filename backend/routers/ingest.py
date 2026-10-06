import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from services.pdf_service import extract_text_from_pdf
from services.vector_service import ingest_document, document_exists
from services.supabase_service import update_document_after_ingest, get_document_by_id

router = APIRouter(prefix="/ingest", tags=["Ingest"])

UPLOAD_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "uploads")
)


class IngestRequest(BaseModel):
    doc_id: str


@router.post("/")
async def ingest_pdf(request: IngestRequest):
    """
    Uploaded PDF ko process karo:
    1. Local temp file se text extract karo
    2. Chunk + embed + pgvector mein store karo
    3. Supabase documents table update karo
    """
    doc_id   = request.doc_id
    pdf_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")

    # ── File check ────────────────────────────────────────────────────────────
    if not os.path.exists(pdf_path):
        raise HTTPException(
            status_code=404,
            detail=f"PDF nahi mili '{doc_id}'. Pehle /upload/ karein."
        )

    # ── Duplicate check ───────────────────────────────────────────────────────
    if document_exists(doc_id):
        raise HTTPException(
            status_code=409,
            detail=f"Document '{doc_id}' pehle se ingest ho chuka hai."
        )

    # ── Extract text ──────────────────────────────────────────────────────────
    try:
        pages_data = extract_text_from_pdf(pdf_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Text extract error: {str(e)}")

    if not pages_data:
        raise HTTPException(
            status_code=422,
            detail="PDF mein readable text nahi mila. Scanned PDF hai?"
        )

    # ── Chunk + embed + store in pgvector ────────────────────────────────────
    try:
        result = ingest_document(doc_id, pages_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest error: {str(e)}")

    # ── Update Supabase documents table ───────────────────────────────────────
    try:
        update_document_after_ingest(
            doc_id=doc_id,
            total_chunks=result["total_chunks"],
            doc_type=result["doc_type"],
            chunk_size=result["chunk_size_used"],
        )
    except Exception as e:
        # Non-fatal — embeddings stored, DB update fail
        print(f"Warning: DB update failed for {doc_id}: {e}")

    return {
        "success":           True,
        "doc_id":            doc_id,
        "pages_processed":   len(pages_data),
        "total_chunks":      result["total_chunks"],
        "doc_type_detected": result["doc_type"],
        "chunk_size_used":   result["chunk_size_used"],
        "document_stats":    result["stats"],
        "message":           result["message"],
        "next_step":         f"Ab /chat/ use karo doc_id='{doc_id}' ke saath"
    }


@router.get("/status/{doc_id}")
async def check_ingest_status(doc_id: str):
    """Document ingest status check karo."""
    pdf_exists  = os.path.exists(os.path.join(UPLOAD_DIR, f"{doc_id}.pdf"))
    is_ingested = document_exists(doc_id)

    # DB se bhi info lo
    db_record = get_document_by_id(doc_id)

    return {
        "doc_id":              doc_id,
        "pdf_locally_cached":  pdf_exists,
        "ingested_in_pgvector": is_ingested,
        "ready_for_chat":      is_ingested,
        "db_record":           db_record,
    }
