import uuid
import os

from fastapi import APIRouter, UploadFile, File, HTTPException
from services.pdf_service import extract_text_from_bytes, get_metadata_from_bytes
from services.supabase_service import upload_pdf_to_storage, insert_document

router = APIRouter(prefix="/upload", tags=["Upload"])

# Local uploads dir — still used as temp storage for ingest
UPLOAD_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "uploads")
)
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/")
async def upload_pdf(file: UploadFile = File(...)):
    """
    PDF upload karo.
    1. Validate
    2. Unique doc_id generate
    3. Supabase Storage mein upload
    4. Local temp copy save (ingest ke liye)
    5. Text extract for page count
    6. DB mein document record insert
    """

    # ── Validate ──────────────────────────────────────────────────────────────
    if file.content_type != "application/pdf":
        raise HTTPException(
            status_code=400,
            detail=f"Sirf PDF files allowed hain. Aapne bheja: {file.content_type}"
        )

    # ── Read bytes ────────────────────────────────────────────────────────────
    file_bytes = await file.read()
    doc_id     = str(uuid.uuid4())

    # ── Supabase Storage upload ───────────────────────────────────────────────
    try:
        storage_path = upload_pdf_to_storage(file_bytes, doc_id, file.filename)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Storage upload error: {str(e)}")

    # ── Local temp save (ingest router PDF path se padhta hai) ───────────────
    local_path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
    with open(local_path, "wb") as f:
        f.write(file_bytes)

    # ── Extract metadata ──────────────────────────────────────────────────────
    try:
        pages_data = extract_text_from_bytes(file_bytes)
        metadata   = get_metadata_from_bytes(file_bytes)
    except Exception as e:
        os.remove(local_path)
        raise HTTPException(status_code=422, detail=f"PDF process error: {str(e)}")

    # ── Insert document record in Supabase DB ─────────────────────────────────
    try:
        insert_document(
            doc_id=doc_id,
            filename=file.filename,
            storage_path=storage_path,
            total_pages=metadata["total_pages"],
            file_size_mb=metadata["file_size_mb"],
        )
    except Exception as e:
        # DB insert fail — cleanup
        os.remove(local_path)
        raise HTTPException(status_code=500, detail=f"DB record insert error: {str(e)}")

    return {
        "success":         True,
        "doc_id":          doc_id,
        "filename":        file.filename,
        "total_pages":     metadata["total_pages"],
        "file_size_mb":    metadata["file_size_mb"],
        "pages_extracted": len(pages_data),
        "storage_path":    storage_path,
        "message":         f"PDF uploaded! {len(pages_data)} pages extracted."
    }
