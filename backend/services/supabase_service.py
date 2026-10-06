import os
from typing import List, Dict, Optional
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# ─── Supabase Client ──────────────────────────────────────────────────────────
# Service role key use karo backend mein — yeh RLS (Row Level Security) bypass
# karta hai. Frontend mein kabhi use mat karna — wahan anon key use hoti hai.
_supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY"),
)

STORAGE_BUCKET = "pdfs"   # Supabase Storage bucket name


# ═══════════════════════════════════════════════════════════════════════════════
# STORAGE — PDF file upload/download/delete
# ═══════════════════════════════════════════════════════════════════════════════

def upload_pdf_to_storage(file_bytes: bytes, doc_id: str, filename: str) -> str:
    """
    PDF file ko Supabase Storage mein upload karo.

    Storage path format: {doc_id}/{filename}
    Agar same doc_id se dobara upload ho toh overwrite ho jaata hai.

    Returns:
        storage_path — DB mein save karne ke liye
    """
    storage_path = f"{doc_id}/{filename}"

    _supabase.storage.from_(STORAGE_BUCKET).upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )

    return storage_path


def get_pdf_signed_url(storage_path: str, expires_in: int = 3600) -> str:
    """
    PDF ke liye temporary signed URL banao.
    Default 1 hour valid rehta hai.
    Frontend mein PDF preview ke liye use hoga.
    """
    result = _supabase.storage.from_(STORAGE_BUCKET).create_signed_url(
        path=storage_path,
        expires_in=expires_in,
    )
    return result.get("signedURL", "")


def delete_pdf_from_storage(storage_path: str) -> bool:
    """PDF Supabase Storage se delete karo."""
    try:
        _supabase.storage.from_(STORAGE_BUCKET).remove([storage_path])
        return True
    except Exception:
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# DOCUMENTS TABLE
# ═══════════════════════════════════════════════════════════════════════════════

def insert_document(
    doc_id: str,
    filename: str,
    storage_path: str,
    total_pages: int,
    file_size_mb: float,
) -> Dict:
    """
    Upload ke baad documents table mein record insert karo.
    doc_id UUID hai jo upload router generate karta hai.
    """
    result = _supabase.table("documents").insert({
        "id":           doc_id,
        "filename":     filename,
        "storage_path": storage_path,
        "total_pages":  total_pages,
        "file_size_mb": float(file_size_mb),
    }).execute()

    return result.data[0] if result.data else {}


def update_document_after_ingest(
    doc_id: str,
    total_chunks: int,
    doc_type: str,
    chunk_size: int,
) -> Dict:
    """
    Ingest complete hone ke baad document record update karo.
    Pehle insert_document() se sirf basic info thi — yeh chunking stats add karta hai.
    """
    result = _supabase.table("documents").update({
        "total_chunks": total_chunks,
        "doc_type":     doc_type,
        "chunk_size":   chunk_size,
        "is_ingested":  True,
    }).eq("id", doc_id).execute()

    return result.data[0] if result.data else {}


def get_all_documents() -> List[Dict]:
    """
    Saare documents fetch karo — latest pehle.
    UploadPage history sidebar ke liye use hoga.
    """
    result = _supabase.table("documents")\
        .select("*")\
        .order("uploaded_at", desc=True)\
        .execute()

    return result.data or []


def get_document_by_id(doc_id: str) -> Optional[Dict]:
    """Single document fetch karo ID se."""
    result = _supabase.table("documents")\
        .select("*")\
        .eq("id", doc_id)\
        .single()\
        .execute()

    return result.data


def delete_document_record(doc_id: str) -> bool:
    """
    Document record delete karo.
    ON DELETE CASCADE se embeddings aur chat_messages bhi delete ho jaate hain.
    """
    try:
        _supabase.table("documents").delete().eq("id", doc_id).execute()
        return True
    except Exception:
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# EMBEDDINGS TABLE (pgvector — replaces ChromaDB)
# ═══════════════════════════════════════════════════════════════════════════════

def insert_embeddings(doc_id: str, chunks: List[Dict]) -> int:
    """
    Chunks + embeddings ko Supabase mein store karo.

    Args:
        doc_id: Document ID
        chunks: [
            {
                "chunk_text":   "...",
                "page_number":  3,
                "chunk_index":  0,
                "embedding":    [0.23, -0.87, ...]   # list of 384 floats
            }
        ]

    Returns:
        Number of chunks inserted
    """
    rows = [
        {
            "doc_id":      doc_id,
            "chunk_text":  c["chunk_text"],
            "page_number": c["page_number"],
            "chunk_index": c["chunk_index"],
            "embedding":   c["embedding"],   # pgvector accepts Python list directly
        }
        for c in chunks
    ]

    # Batch insert in groups of 100 — Supabase has request size limits
    batch_size = 100
    total_inserted = 0

    for i in range(0, len(rows), batch_size):
        batch = rows[i : i + batch_size]
        result = _supabase.table("embeddings").insert(batch).execute()
        total_inserted += len(result.data)

    return total_inserted


def search_embeddings(doc_id: str, query_embedding: List[float], n_results: int = 6) -> List[Dict]:
    """
    pgvector cosine similarity search karo.

    Supabase mein vector search ke liye RPC (Remote Procedure Call) use karta hai —
    ek PostgreSQL function call karte hain jo vector search karta hai.

    SQL function match_embeddings() hum Supabase SQL editor mein banayenge.

    Returns:
        [{"chunk_text": "...", "page_number": 3, "similarity": 0.92}, ...]
    """
    result = _supabase.rpc(
        "match_embeddings",
        {
            "query_embedding": query_embedding,
            "match_doc_id":    doc_id,
            "match_count":     n_results,
        }
    ).execute()

    return result.data or []


def delete_embeddings(doc_id: str) -> bool:
    """Document ke saare embeddings delete karo."""
    try:
        _supabase.table("embeddings").delete().eq("doc_id", doc_id).execute()
        return True
    except Exception:
        return False


def embeddings_exist(doc_id: str) -> bool:
    """Check karo kya document ke embeddings already store hain."""
    result = _supabase.table("embeddings")\
        .select("id")\
        .eq("doc_id", doc_id)\
        .limit(1)\
        .execute()

    return len(result.data) > 0


# ═══════════════════════════════════════════════════════════════════════════════
# CHAT MESSAGES TABLE
# ═══════════════════════════════════════════════════════════════════════════════

def insert_chat_message(
    doc_id: str,
    role: str,
    content: str,
    citations: List[int] = None,
) -> Dict:
    """
    Ek chat message save karo.
    role = 'user' ya 'assistant'
    citations = page numbers list (sirf assistant messages ke liye)
    """
    result = _supabase.table("chat_messages").insert({
        "doc_id":    doc_id,
        "role":      role,
        "content":   content,
        "citations": citations or [],
    }).execute()

    return result.data[0] if result.data else {}


def get_chat_history(doc_id: str) -> List[Dict]:
    """
    Document ki poori chat history fetch karo — oldest first.
    ChatPage load hone pe call hota hai.
    """
    result = _supabase.table("chat_messages")\
        .select("*")\
        .eq("doc_id", doc_id)\
        .order("created_at", desc=False)\
        .execute()

    return result.data or []


def delete_chat_history(doc_id: str) -> bool:
    """Document ki saari chat history delete karo."""
    try:
        _supabase.table("chat_messages").delete().eq("doc_id", doc_id).execute()
        return True
    except Exception:
        return False
