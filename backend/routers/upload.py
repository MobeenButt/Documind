import uuid
import os

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends

from services.pdf_service import (
    extract_text_from_bytes,
    get_metadata_from_bytes,
    UPLOAD_DIR,
)
from services.mongo_service import insert_document
from services.auth_service import get_user_id

router = APIRouter(prefix="/upload", tags=["Upload"])

os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/")
async def upload_pdf(
    file: UploadFile = File(...),
    user_id: str = Depends(get_user_id),
):
    """
    Upload a PDF.

    Depends(get_user_id) reads the Bearer token from the Authorization
    header, verifies the JWT, and extracts the user_id. A missing or
    invalid token results in a 401 response automatically.

    The PDF is saved to the local filesystem and a document record is
    created with this user_id as the owner.
    """

    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail=f"Only PDF files are allowed. Received: {file.content_type}",
        )

    file_bytes = await file.read()
    doc_id = str(uuid.uuid4())

    # Save the PDF locally (used by the ingest step)
    local_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
    with open(local_path, "wb") as f:
        f.write(file_bytes)

    # Extract metadata + text
    try:
        pages_data = extract_text_from_bytes(file_bytes)
        metadata = get_metadata_from_bytes(file_bytes)
    except Exception as e:
        os.remove(local_path)
        raise HTTPException(status_code=422, detail=f"PDF processing error: {str(e)}")

    # Create the document record owned by this user
    try:
        insert_document(
            doc_id=doc_id,
            filename=file.filename,
            total_pages=metadata["total_pages"],
            file_size_mb=metadata["file_size_mb"],
            user_id=user_id,
        )
    except Exception as e:
        os.remove(local_path)
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")

    return {
        "success": True,
        "doc_id": doc_id,
        "filename": file.filename,
        "total_pages": metadata["total_pages"],
        "file_size_mb": metadata["file_size_mb"],
        "pages_extracted": len(pages_data),
        "message": f"Uploaded. {len(pages_data)} pages extracted.",
    }
