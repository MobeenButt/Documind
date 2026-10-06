from fastapi import APIRouter, HTTPException
from services.supabase_service import (
    get_all_documents,
    get_document_by_id,
    delete_document_record,
    delete_pdf_from_storage,
    delete_chat_history,
)
from services.vector_service import delete_document

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("/")
async def list_documents():
    """
    Saare documents list karo — latest pehle.
    UploadPage history sidebar ke liye use hoga.
    """
    try:
        docs = get_all_documents()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Documents fetch error: {str(e)}")

    return {
        "documents": docs,
        "count":     len(docs),
    }


@router.get("/{doc_id}")
async def get_document(doc_id: str):
    """Single document ki detail lo."""
    doc = get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' nahi mila.")
    return doc


@router.delete("/{doc_id}")
async def delete_document_completely(doc_id: str):
    """
    Document completely delete karo:
    1. pgvector embeddings
    2. Supabase Storage PDF
    3. Chat history (CASCADE se auto hota hai lekin explicit bhi karo)
    4. DB record
    """
    doc = get_document_by_id(doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' nahi mila.")

    errors = []

    # pgvector embeddings
    if not delete_document(doc_id):
        errors.append("embeddings delete failed")

    # Storage PDF
    if doc.get("storage_path"):
        if not delete_pdf_from_storage(doc["storage_path"]):
            errors.append("storage delete failed")

    # Chat history
    delete_chat_history(doc_id)

    # DB record (CASCADE handles embeddings + chat too)
    if not delete_document_record(doc_id):
        errors.append("db record delete failed")

    return {
        "success": len(errors) == 0,
        "doc_id":  doc_id,
        "errors":  errors,
        "message": "Document deleted." if not errors else f"Partial delete. Errors: {errors}"
    }
