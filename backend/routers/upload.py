import uuid
import os
import shutil

from fastapi import APIRouter, UploadFile, File, HTTPException
from services.pdf_service import extract_text_from_pdf, get_pdf_metadata

# ─── Router Setup ─────────────────────────────────────────────────────────────
# APIRouter() ek mini FastAPI app jaisa hai.
# prefix="/upload" matlab har endpoint ka URL /upload se shuru hoga.
# tags=["Upload"] Swagger docs mein grouping ke liye hota hai.
router = APIRouter(prefix="/upload", tags=["Upload"])

# ─── Upload Directory ─────────────────────────────────────────────────────────
# Uploaded PDFs yahan save honge.
# os.path.dirname(__file__) = current file ki directory (routers/)
# os.path.join(..., "..", "uploads") = ek level upar jaao, phir uploads/ folder
# os.path.abspath() = relative path ko absolute path mein convert karo
UPLOAD_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "uploads")
)

# Agar uploads/ folder exist nahi karta toh create karo
# exist_ok=True matlab agar pehle se exist kare toh error mat do
os.makedirs(UPLOAD_DIR, exist_ok=True)


# ─── Upload Endpoint ──────────────────────────────────────────────────────────
@router.post("/")
async def upload_pdf(file: UploadFile = File(...)):
    """
    PDF file upload karo.

    Flow:
    1. File validate karo — sirf PDF allow hai
    2. Unique ID generate karo
    3. File disk pe save karo
    4. PDF se text extract karo
    5. Response mein doc_id aur page data return karo

    'async' isliye kyunki file.read() I/O operation hai —
    FastAPI is waqt dusre requests bhi handle kar sakta hai.

    'File(...)' ka matlab yeh parameter required hai — '...' Python mein
    Ellipsis hai jo FastAPI ko batata hai field optional nahi hai.
    """

    # ── Step 1: Validation ────────────────────────────────────────────────────
    # content_type check karo — sirf PDF accept karo
    # application/pdf standard MIME type hai PDF ke liye
    if file.content_type != "application/pdf":
        # HTTPException FastAPI ka built-in error class hai
        # status_code=400 = Bad Request (client ki galti)
        # detail = error message jo response mein jayega
        raise HTTPException(
            status_code=400,
            detail=f"Sirf PDF files allowed hain. Aapne bheja: {file.content_type}"
        )

    # ── Step 2: Unique ID Generate ────────────────────────────────────────────
    # uuid4() random UUID generate karta hai — globally unique hoga
    # str() se "550e8400-e29b-41d4-a716-446655440000" jaisi string milti hai
    doc_id = str(uuid.uuid4())

    # File ka naam: doc_id + .pdf
    # Kyun original naam nahi rakha? Kyunki:
    # - Do alag users same naam ki file upload kar sakte hain
    # - Original naam mein spaces ya special chars ho sakte hain
    save_filename = f"{doc_id}.pdf"
    save_path = os.path.join(UPLOAD_DIR, save_filename)

    # ── Step 3: File Save ─────────────────────────────────────────────────────
    try:
        # file.read() async hai — await lagana zaroori hai
        # Yeh poora file content bytes mein padhta hai memory mein
        file_content = await file.read()

        # Ab bytes ko disk pe likho
        # "wb" = write binary mode — PDF binary file hai, text nahi
        with open(save_path, "wb") as f:
            f.write(file_content)

    except Exception as e:
        # Agar file save mein koi bhi error aaye toh 500 return karo
        # status_code=500 = Internal Server Error (server ki galti)
        raise HTTPException(
            status_code=500,
            detail=f"File save karne mein error: {str(e)}"
        )

    # ── Step 4: PDF Text Extraction ───────────────────────────────────────────
    try:
        # pdf_service se extract karo — yeh List[Dict] return karta hai
        # [{"page_number": 1, "text": "..."}, ...]
        pages_data = extract_text_from_pdf(save_path)

        # PDF metadata bhi lo — total pages, file size
        metadata = get_pdf_metadata(save_path)

    except Exception as e:
        # Agar PDF corrupt hai ya extract fail ho toh saved file bhi delete karo
        # Disk pe garbage mat chhodho
        if os.path.exists(save_path):
            os.remove(save_path)

        raise HTTPException(
            status_code=422,  # 422 = Unprocessable Entity — file aayi lekin process nahi ho sakti
            detail=f"PDF process karne mein error: {str(e)}"
        )

    # ── Step 5: Response ──────────────────────────────────────────────────────
    # Yeh response frontend ko jayega aur next step (ingestion) mein bhi use hoga
    return {
        "success": True,
        "doc_id": doc_id,                          # Unique document identifier
        "filename": file.filename,                  # Original file name (user ko dikhane ke liye)
        "total_pages": metadata["total_pages"],     # Kitne pages hain PDF mein
        "file_size_mb": metadata["file_size_mb"],   # File size
        "pages_extracted": len(pages_data),         # Kitne pages se text mila (blank pages minus)
        "message": f"PDF successfully upload hua! {len(pages_data)} pages extract hue."
    }
