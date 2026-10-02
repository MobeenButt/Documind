import pdfplumber
import os
from typing import List, Dict


def extract_text_from_pdf(file_path: str) -> List[Dict]:
    """
    PDF file ko open karo aur har page ka text extract karo.

    Returns:
        List of dicts — har dict mein page_number aur text hota hai.
        Example:
        [
            {"page_number": 1, "text": "Introduction..."},
            {"page_number": 2, "text": "Chapter 1..."},
        ]
    """

    # Pehle check karo file exist karti hai ya nahi
    # Agar nahi karti toh seedha error throw karo — baad mein debug karna mushkil hoga
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file nahi mili: {file_path}")

    pages_data = []  # Yahan har page ka data store hoga

    # pdfplumber.open() ek context manager hai
    # 'with' block ke baad automatically file close ho jaati hai — memory leak nahi hoga
    with pdfplumber.open(file_path) as pdf:

        # pdf.pages ek list hai — index 0 se shuru hota hai
        # enumerate() se hume index bhi milta hai aur page object bhi
        for index, page in enumerate(pdf.pages):

            # extract_text() page ka sara text ek string mein deta hai
            # Agar page blank ho ya sirf image ho toh yeh None return karta hai
            text = page.extract_text()

            # Blank/image-only pages skip karo — inhe store karna useless hai
            # strip() whitespace-only strings ko bhi filter kar deta hai
            if text and text.strip():
                pages_data.append({
                    "page_number": index + 1,  # index 0-based hai, page number 1-based hona chahiye
                    "text": text.strip()        # leading/trailing whitespace hatao
                })

    return pages_data


def get_pdf_metadata(file_path: str) -> Dict:
    """
    PDF ki basic info return karo — total pages, file size etc.
    Yeh upload response mein user ko dikhane ke liye use hoga.
    """

    if not os.path.exists(file_path):
        raise FileNotFoundError(f"PDF file nahi mili: {file_path}")

    with pdfplumber.open(file_path) as pdf:
        total_pages = len(pdf.pages)

    # os.path.getsize() bytes mein size deta hai
    # 1024 * 1024 se divide karke MB mein convert karo
    file_size_mb = round(os.path.getsize(file_path) / (1024 * 1024), 2)

    return {
        "total_pages": total_pages,
        "file_size_mb": file_size_mb
    }
