import os

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from services.pdf_service import extract_text_from_pdf
from services.vector_service import ingest_document, document_exists
from services.supabase_service import update_document_after_ingest, get_document_by_id
from services.auth_service import get_user_id

router = APIRouter(prefix="/ingest", tags=["Ingest"])

UPLOAD_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "uploads")
)


class IngestRequest(BaseModel):
    doc_id: str


@router.post("/")
async def ingest_pdf(
    request: IngestRequest,
    user_id: str = Depends(get_user_id),   # ← Auth required
):
    """
    PDF process karo — chunk + embed + pgvector store.

    Ownership verify karta hai:
    - Document exist karta hai DB mein?
    - Is user ka hai?
    """
    doc_id = request.doc_id

    # Ownership verify karo — sirf owner ingest kar sakta hai
    doc = get_document_by_id(doc_id, user_id)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Document nahi mila ya aapka nahi hai."
        )

    pdf_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
    if not os.path.exists(pdf_path):
        raise HTTPException(
            status_code=404,
            detail="PDF file locally nahi mili. Dobara upload karein."
        )

    if document_exists(doc_id):
        raise HTTPException(
            status_code=409,
            detail="Document pehle se process ho chuka hai."
        )

    try:
        pages_data = extract_text_from_pdf(pdf_path)
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Text extract error: {str(e)}")

    if not pages_data:
        raise HTTPException(
            status_code=422,
            detail="PDF mein readable text nahi mila. Scanned hai?"
        )

    try:
        result = ingest_document(doc_id, pages_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingest error: {str(e)}")

    try:
        update_document_after_ingest(
            doc_id=doc_id,
            total_chunks=result["total_chunks"],
            doc_type=result["doc_type"],
            chunk_size=result["chunk_size_used"],
            user_id=user_id,
        )
    except Exception as e:
        print(f"Warning: DB update failed: {e}")

    return {
        "success":           True,
        "doc_id":            doc_id,
        "pages_processed":   len(pages_data),
        "total_chunks":      result["total_chunks"],
        "doc_type_detected": result["doc_type"],
        "chunk_size_used":   result["chunk_size_used"],
        "document_stats":    result["stats"],
        "message":           result["message"],
    }


@router.get("/status/{doc_id}")
async def check_ingest_status(
    doc_id: str,
    user_id: str = Depends(get_user_id),
):
    """Document ingest status check karo."""
    doc         = get_document_by_id(doc_id, user_id)
    is_ingested = document_exists(doc_id)

    return {
        "doc_id":               doc_id,
        "exists_in_db":         doc is not None,
        "ingested_in_pgvector": is_ingested,
        "ready_for_chat":       is_ingested,
        "db_record":            doc,
    }
