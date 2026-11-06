"""
pdf_service.py — PDF text extraction and file management.

PDFs are stored on the local filesystem under backend/uploads/.
"""

import io
import os
from typing import List, Dict

import pdfplumber

UPLOAD_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "uploads")
)


def extract_text_from_pdf(file_path: str) -> List[Dict]:
    """
    Open a PDF file and extract text from every page.

    Returns a list of dicts, one per page with text:
        [{"page_number": 1, "text": "Introduction..."}, ...]
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file not found: {file_path}")

    pages_data = []
    with pdfplumber.open(file_path) as pdf:
        for index, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text and text.strip():
                pages_data.append({
                    "page_number": index + 1,
                    "text": text.strip(),
                })
    return pages_data


def get_pdf_metadata(file_path: str) -> Dict:
    """Return basic info about a PDF: total pages and file size."""
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file not found: {file_path}")

    with pdfplumber.open(file_path) as pdf:
        total_pages = len(pdf.pages)

    file_size_mb = round(os.path.getsize(file_path) / (1024 * 1024), 2)
    return {"total_pages": total_pages, "file_size_mb": file_size_mb}


def extract_text_from_bytes(pdf_bytes: bytes) -> List[Dict]:
    """Extract text directly from PDF bytes (used on upload)."""
    pages_data = []
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for index, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text and text.strip():
                pages_data.append({
                    "page_number": index + 1,
                    "text": text.strip(),
                })
    return pages_data


def get_metadata_from_bytes(pdf_bytes: bytes) -> Dict:
    """Return basic info about a PDF from its bytes."""
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        total_pages = len(pdf.pages)
    file_size_mb = round(len(pdf_bytes) / (1024 * 1024), 2)
    return {"total_pages": total_pages, "file_size_mb": file_size_mb}


def delete_pdf_file(doc_id: str) -> bool:
    """Delete the locally stored PDF for a document. Returns True if removed."""
    path = os.path.join(UPLOAD_DIR, f"{doc_id}.pdf")
    try:
        if os.path.exists(path):
            os.remove(path)
            return True
        return False
    except OSError:
        return False
