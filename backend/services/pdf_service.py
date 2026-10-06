import pdfplumber
import os
from typing import List, Dict


def extract_text_from_pdf(file_path: str) -> List[Dict]:
    """
    PDF file ko open karo aur har page ka text extract karo.

    Returns:
        List of dicts — har dict mein page_number aur text hota hai.
        [
            {"page_number": 1, "text": "Introduction..."},
            {"page_number": 2, "text": "Chapter 1..."},
        ]
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file nahi mili: {file_path}")

    pages_data = []

    with pdfplumber.open(file_path) as pdf:
        for index, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text and text.strip():
                pages_data.append({
                    "page_number": index + 1,
                    "text": text.strip()
                })

    return pages_data


def get_pdf_metadata(file_path: str) -> Dict:
    """
    PDF ki basic info return karo — total pages, file size.
    Upload response mein user ko dikhane ke liye use hoga.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file nahi mili: {file_path}")

    with pdfplumber.open(file_path) as pdf:
        total_pages = len(pdf.pages)

    file_size_mb = round(os.path.getsize(file_path) / (1024 * 1024), 2)

    return {
        "total_pages": total_pages,
        "file_size_mb": file_size_mb
    }


def extract_text_from_bytes(pdf_bytes: bytes) -> List[Dict]:
    """
    PDF bytes se directly text extract karo — file path ki zaroorat nahi.
    Supabase Storage se download ke baad use hoga.

    pdfplumber BytesIO accept karta hai directly.
    """
    import io
    pages_data = []

    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        for index, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text and text.strip():
                pages_data.append({
                    "page_number": index + 1,
                    "text": text.strip()
                })

    return pages_data


def get_metadata_from_bytes(pdf_bytes: bytes) -> Dict:
    """PDF bytes se metadata extract karo."""
    import io
    with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
        total_pages = len(pdf.pages)

    file_size_mb = round(len(pdf_bytes) / (1024 * 1024), 2)

    return {
        "total_pages": total_pages,
        "file_size_mb": file_size_mb
    }
