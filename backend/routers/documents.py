from fastapi import APIRouter, HTTPException, Depends
from services.supabase_service import (
    get_all_documents,
    get_document_by_id,
    delete_document_record,
    delete_pdf_from_storage,
    delete_chat_history,
)
from services.vector_service import delete_document
from services.auth_service import get_user_id

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("/")
async def list_documents(
    user_id: str = Depends(get_user_id),
):
    """Sirf is user ke documents list karo."""
    try:
        docs = get_all_documents(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fetch error: {str(e)}")

    return {"documents": docs, "count": len(docs)}


@router.get("/{doc_id}")
async def get_document(
    doc_id: str,
    user_id: str = Depends(get_user_id),
):
    """Single document — ownership verify karke."""
    doc = get_document_by_id(doc_id, user_id)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Document nahi mila ya aapka nahi hai."
        )
    return doc


@router.delete("/{doc_id}")
async def delete_document_completely(
    doc_id: str,
    user_id: str = Depends(get_user_id),
):
    """
    Document completely delete karo.
    Sirf owner delete kar sakta hai.
    """
    doc = get_document_by_id(doc_id, user_id)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Document nahi mila ya aapka nahi hai."
        )

    errors = []

    if not delete_document(doc_id):
        errors.append("embeddings delete failed")

    if doc.get("storage_path"):
        if not delete_pdf_from_storage(doc["storage_path"]):
            errors.append("storage delete failed")

    delete_chat_history(doc_id, user_id)

    if not delete_document_record(doc_id, user_id):
        errors.append("db record delete failed")

    return {
        "success": len(errors) == 0,
        "doc_id":  doc_id,
        "errors":  errors,
        "message": "Deleted." if not errors else f"Partial. Errors: {errors}",
    }
