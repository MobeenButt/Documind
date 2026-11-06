from fastapi import APIRouter, HTTPException, Depends

from services.mongo_service import (
    get_all_documents,
    get_document_by_id,
    delete_document_record,
    delete_chat_history,
)
from services.pdf_service import delete_pdf_file
from services.vector_service import delete_document
from services.auth_service import get_user_id

router = APIRouter(prefix="/documents", tags=["Documents"])


@router.get("/")
async def list_documents(
    user_id: str = Depends(get_user_id),
):
    """List all documents owned by the current user."""
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
    """Fetch a single document, verifying ownership."""
    doc = get_document_by_id(doc_id, user_id)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Document not found or you do not have access.",
        )
    return doc


@router.delete("/{doc_id}")
async def delete_document_completely(
    doc_id: str,
    user_id: str = Depends(get_user_id),
):
    """Delete a document and all of its associated data. Owner only."""
    doc = get_document_by_id(doc_id, user_id)
    if not doc:
        raise HTTPException(
            status_code=404,
            detail="Document not found or you do not have access.",
        )

    errors = []

    if not delete_document(doc_id):
        errors.append("embeddings delete failed")

    if not delete_pdf_file(doc_id):
        errors.append("pdf file delete failed")

    delete_chat_history(doc_id, user_id)

    if not delete_document_record(doc_id, user_id):
        errors.append("db record delete failed")

    return {
        "success": len(errors) == 0,
        "doc_id": doc_id,
        "errors": errors,
        "message": "Deleted." if not errors else f"Partial delete. Errors: {errors}",
    }
