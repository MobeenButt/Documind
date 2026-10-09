import uuid
import os

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from services.pdf_service import extract_text_from_bytes, get_metadata_from_bytes
from services.supabase_service import upload_pdf_to_storage, insert_document
from services.auth_service import get_user_id

router = APIRouter(prefix="/upload", tags=["Upload"])

UPLOAD_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "uploads")
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/")
async def upload_pdf(
    file: UploadFile = File(...),
    user_id: str = Depends(get_user_id),   # ← Auth required
):
    """
    PDF upload karo.

    Depends(get_user_id) kya karta hai?
    - Request ke Authorization header se Bearer token nikalta hai
    - JWT verify karta hai
    - user_id extract karta hai
    - Agar token missing/invalid ho → 401 Unauthorized automatically

    user_id document ke saath save hota hai taaki
    sirf yeh user baad mein is document ko access kar sake.
    """

    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail=f"Sirf PDF allowed. Aapne bheja: {file.content_type}"
        )

    file_bytes = await file.read()
    doc_id     = str(uuid.uuid4())

    # Supabase Storage mein save karo
    try:
        storage_path = upload_pdf_to_storage(file_bytes, doc_id, file.filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage error: {str(e)}")

    # Local temp copy (ingest ke liye)
    local_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
    with open(local_path, "wb") as f:
        f.write(file_bytes)

    # Metadata extract
    try:
        pages_data = extract_text_from_bytes(file_bytes)
        metadata   = get_metadata_from_bytes(file_bytes)
    except Exception as e:
        os.remove(local_path)
        raise HTTPException(status_code=422, detail=f"PDF process error: {str(e)}")

    # DB record — user_id ke saath
    try:
        insert_document(
            doc_id=doc_id,
            filename=file.filename,
            storage_path=storage_path,
            total_pages=metadata["total_pages"],
            file_size_mb=metadata["file_size_mb"],
            user_id=user_id,                       # ← owner set karo
        )
    except Exception as e:
        os.remove(local_path)
        raise HTTPException(status_code=500, detail=f"DB insert error: {str(e)}")

    return {
        "success":         True,
        "doc_id":          doc_id,
        "filename":        file.filename,
        "total_pages":     metadata["total_pages"],
        "file_size_mb":    metadata["file_size_mb"],
        "pages_extracted": len(pages_data),
        "message":         f"Uploaded! {len(pages_data)} pages extracted.",
    }
