"""
supabase_service.py — All Supabase DB + Storage operations

Architecture note:
- Backend uses SERVICE ROLE key — bypasses RLS
- user_id is passed manually to every query
- This gives us full control while keeping data isolated per user
"""

import os
from typing import List, Dict, Optional
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()

# ─── Client ───────────────────────────────────────────────────────────────────
_supabase: Client = create_client(
    os.getenv("SUPABASE_URL"),
    os.getenv("SUPABASE_SERVICE_KEY"),
)

STORAGE_BUCKET = "pdfs"


# ═══════════════════════════════════════════════════════════════════════════════
# STORAGE
# ═══════════════════════════════════════════════════════════════════════════════

def upload_pdf_to_storage(file_bytes: bytes, doc_id: str, filename: str) -> str:
    """PDF ko Supabase Storage bucket mein save karo."""
    storage_path = f"{doc_id}/{filename}"
    _supabase.storage.from_(STORAGE_BUCKET).upload(
        path=storage_path,
        file=file_bytes,
        file_options={"content-type": "application/pdf", "upsert": "true"},
    )
    return storage_path


def get_pdf_signed_url(storage_path: str, expires_in: int = 3600) -> str:
    """PDF download ke liye temporary signed URL."""
    result = _supabase.storage.from_(STORAGE_BUCKET).create_signed_url(
        path=storage_path, expires_in=expires_in,
    )
    return result.get("signedURL", "")


def delete_pdf_from_storage(storage_path: str) -> bool:
    """PDF Storage se delete karo."""
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
    user_id: str,        # ← NEW: har document ka owner
) -> Dict:
    """Document record insert karo — user_id ke saath."""
    result = _supabase.table("documents").insert({
        "id":           doc_id,
        "filename":     filename,
        "storage_path": storage_path,
        "total_pages":  total_pages,
        "file_size_mb": float(file_size_mb),
        "user_id":      user_id,             # ← owner set karo
    }).execute()
    return result.data[0] if result.data else {}


def update_document_after_ingest(
    doc_id: str,
    total_chunks: int,
    doc_type: str,
    chunk_size: int,
    user_id: str,        # ← verify ownership
) -> Dict:
    """Ingest ke baad document record update karo."""
    result = _supabase.table("documents").update({
        "total_chunks": total_chunks,
        "doc_type":     doc_type,
        "chunk_size":   chunk_size,
        "is_ingested":  True,
    }).eq("id", doc_id).eq("user_id", user_id).execute()  # ← ownership check
    return result.data[0] if result.data else {}


def get_all_documents(user_id: str) -> List[Dict]:
    """
    Sirf is user ke documents return karo.
    .eq("user_id", user_id) = WHERE user_id = '...'
    """
    result = _supabase.table("documents")\
        .select("*")\
        .eq("user_id", user_id)\
        .order("uploaded_at", desc=True)\
        .execute()
    return result.data or []


def get_document_by_id(doc_id: str, user_id: str) -> Optional[Dict]:
    """
    Document fetch karo — sirf agar user ka ho.
    Dono conditions match karni chahiye: id AND user_id.
    """
    result = _supabase.table("documents")\
        .select("*")\
        .eq("id", doc_id)\
        .eq("user_id", user_id)\
        .single()\
        .execute()
    return result.data


def delete_document_record(doc_id: str, user_id: str) -> bool:
    """Document delete karo — sirf owner kar sakta hai."""
    try:
        _supabase.table("documents")\
            .delete()\
            .eq("id", doc_id)\
            .eq("user_id", user_id)\
            .execute()
        return True
    except Exception:
        return False


# ═══════════════════════════════════════════════════════════════════════════════
# EMBEDDINGS TABLE
# ═══════════════════════════════════════════════════════════════════════════════

def insert_embeddings(doc_id: str, chunks: List[Dict]) -> int:
    """Chunks + vectors Supabase pgvector mein store karo."""
    rows = [
        {
            "doc_id":      doc_id,
            "chunk_text":  c["chunk_text"],
            "page_number": c["page_number"],
            "chunk_index": c["chunk_index"],
            "embedding":   c["embedding"],
        }
        for c in chunks
    ]
    batch_size    = 100
    total_inserted = 0
    for i in range(0, len(rows), batch_size):
        result = _supabase.table("embeddings").insert(rows[i:i+batch_size]).execute()
        total_inserted += len(result.data)
    return total_inserted


def search_embeddings(doc_id: str, query_embedding: List[float], n_results: int = 6) -> List[Dict]:
    """pgvector similarity search via RPC function."""
    result = _supabase.rpc("match_embeddings", {
        "query_embedding": query_embedding,
        "match_doc_id":    doc_id,
        "match_count":     n_results,
    }).execute()
    return result.data or []


def delete_embeddings(doc_id: str) -> bool:
    """Document ke saare embeddings delete karo."""
    try:
        _supabase.table("embeddings").delete().eq("doc_id", doc_id).execute()
        return True
    except Exception:
        return False


def embeddings_exist(doc_id: str) -> bool:
    """Check karo kya embeddings exist karte hain."""
    result = _supabase.table("embeddings")\
        .select("id").eq("doc_id", doc_id).limit(1).execute()
    return len(result.data) > 0


# ═══════════════════════════════════════════════════════════════════════════════
# CHAT MESSAGES TABLE
# ═══════════════════════════════════════════════════════════════════════════════

def insert_chat_message(
    doc_id: str,
    role: str,
    content: str,
    user_id: str,        # ← NEW: message ka owner
    citations: List[int] = None,
) -> Dict:
    """Chat message save karo with user_id."""
    result = _supabase.table("chat_messages").insert({
        "doc_id":    doc_id,
        "role":      role,
        "content":   content,
        "citations": citations or [],
        "user_id":   user_id,
    }).execute()
    return result.data[0] if result.data else {}


def get_chat_history(doc_id: str, user_id: str) -> List[Dict]:
    """
    Document ki chat history — sirf is user ki.
    Both doc_id AND user_id must match.
    """
    result = _supabase.table("chat_messages")\
        .select("*")\
        .eq("doc_id", doc_id)\
        .eq("user_id", user_id)\
        .order("created_at", desc=False)\
        .execute()
    return result.data or []


def delete_chat_history(doc_id: str, user_id: str = None) -> bool:
    """Chat history delete karo."""
    try:
        query = _supabase.table("chat_messages").delete().eq("doc_id", doc_id)
        if user_id:
            query = query.eq("user_id", user_id)
        query.execute()
        return True
    except Exception:
        return False
