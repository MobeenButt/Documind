"""
mongo_service.py — MongoDB data layer for DocuMind.

One database, four collections:
  - documents      : one record per uploaded PDF (owner = user_id)
  - embeddings      : one record per text chunk + its vector (cosine search)
  - chat_messages   : one record per chat turn (owner = user_id)
  - users           : auth accounts (email + bcrypt password hash)

Vector search is done here with cosine similarity in Python, so no separate
vector database is required.
"""

import os
from datetime import datetime, timezone
from typing import List, Dict, Optional

import numpy as np
from pymongo import MongoClient, ASCENDING, DESCENDING
from bson import ObjectId
from dotenv import load_dotenv

load_dotenv()

# ─── Connection ────────────────────────────────────────────────────────────────
_client: MongoClient = MongoClient(os.getenv("MONGO_URI", "mongodb://localhost:27017"))
_db = _client[os.getenv("MONGO_DB", "documind")]

documents_col = _db["documents"]
embeddings_col = _db["embeddings"]
chat_col = _db["chat_messages"]
users_col = _db["users"]

# Idempotent indexes (safe to run on every startup). Wrapped so the module
# still imports if MongoDB is not yet reachable — indexes get created on a
# later startup once the database is up.
try:
    documents_col.create_index([("user_id", 1), ("uploaded_at", -1)])
    embeddings_col.create_index("doc_id")
    chat_col.create_index([("doc_id", 1), ("user_id", 1), ("created_at", 1)])
    users_col.create_index("email", unique=True)
except Exception as e:
    print(f"[mongo] index setup skipped: {e}")


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ═══════════════════════════════════════════════════════════════════════════════
# DOCUMENTS
# ═══════════════════════════════════════════════════════════════════════════════

def insert_document(
    doc_id: str,
    filename: str,
    total_pages: int,
    file_size_mb: float,
    user_id: str,
) -> Dict:
    """Insert a document record owned by user_id."""
    doc = {
        "_id": doc_id,                 # use the uuid string as the primary key
        "filename": filename,
        "total_pages": total_pages,
        "file_size_mb": float(file_size_mb),
        "user_id": user_id,
        "is_ingested": False,
        "total_chunks": 0,
        "doc_type": None,
        "chunk_size": 0,
        "uploaded_at": _now(),
    }
    documents_col.insert_one(doc)
    doc["id"] = doc["_id"]
    return doc


def update_document_after_ingest(
    doc_id: str,
    total_chunks: int,
    doc_type: str,
    chunk_size: int,
    user_id: str,
) -> Dict:
    """Update a document after ingestion (owner-scoped)."""
    documents_col.update_one(
        {"_id": doc_id, "user_id": user_id},
        {"$set": {
            "total_chunks": total_chunks,
            "doc_type": doc_type,
            "chunk_size": chunk_size,
            "is_ingested": True,
        }},
    )
    return get_document_by_id(doc_id, user_id) or {}


def get_all_documents(user_id: str) -> List[Dict]:
    """Return all documents owned by user_id, newest first."""
    docs = list(
        documents_col.find({"user_id": user_id}).sort("uploaded_at", DESCENDING)
    )
    for d in docs:
        d["id"] = d["_id"]
    return docs


def get_document_by_id(doc_id: str, user_id: str) -> Optional[Dict]:
    """Fetch a document if it belongs to user_id, otherwise None."""
    doc = documents_col.find_one({"_id": doc_id, "user_id": user_id})
    if doc:
        doc["id"] = doc["_id"]
    return doc


def delete_document_record(doc_id: str, user_id: str) -> bool:
    """Delete a document record (owner-scoped)."""
    result = documents_col.delete_one({"_id": doc_id, "user_id": user_id})
    return result.deleted_count > 0


# ═══════════════════════════════════════════════════════════════════════════════
# EMBEDDINGS  (vector search via cosine similarity)
# ═══════════════════════════════════════════════════════════════════════════════

def insert_embeddings(doc_id: str, chunks: List[Dict]) -> int:
    """Store text chunks and their embeddings for a document."""
    rows = [
        {
            "doc_id": doc_id,
            "chunk_text": c["chunk_text"],
            "page_number": c["page_number"],
            "chunk_index": c["chunk_index"],
            "embedding": c["embedding"],
        }
        for c in chunks
    ]
    if not rows:
        return 0
    result = embeddings_col.insert_many(rows)
    return len(result.inserted_ids)


def search_embeddings(doc_id: str, query_embedding: List[float], n_results: int = 6) -> List[Dict]:
    """Cosine-similarity search over a single document's embeddings."""
    query = np.asarray(query_embedding, dtype=np.float32)
    q_norm = np.linalg.norm(query)
    if q_norm == 0:
        return []
    query_unit = query / q_norm

    scored = []
    for row in embeddings_col.find({"doc_id": doc_id}):
        emb = np.asarray(row["embedding"], dtype=np.float32)
        e_norm = np.linalg.norm(emb)
        if e_norm == 0:
            continue
        sim = float(np.dot(query_unit, emb / e_norm))
        scored.append({
            "chunk_text": row["chunk_text"],
            "page_number": row["page_number"],
            "chunk_index": row.get("chunk_index", 0),
            "similarity": sim,
        })

    scored.sort(key=lambda x: x["similarity"], reverse=True)
    return scored[:n_results]


def delete_embeddings(doc_id: str) -> bool:
    """Delete all embeddings for a document."""
    embeddings_col.delete_many({"doc_id": doc_id})
    return True


def embeddings_exist(doc_id: str) -> bool:
    """True if any embedding exists for the document."""
    return embeddings_col.find_one({"doc_id": doc_id}, {"_id": 1}) is not None


# ═══════════════════════════════════════════════════════════════════════════════
# CHAT MESSAGES
# ═══════════════════════════════════════════════════════════════════════════════

def insert_chat_message(
    doc_id: str,
    role: str,
    content: str,
    user_id: str,
    citations: Optional[List[int]] = None,
) -> Dict:
    """Save a chat message owned by user_id."""
    result = chat_col.insert_one({
        "doc_id": doc_id,
        "role": role,
        "content": content,
        "citations": citations or [],
        "user_id": user_id,
        "created_at": _now(),
    })
    return {
        "id": str(result.inserted_id),
        "doc_id": doc_id,
        "role": role,
        "content": content,
        "citations": citations or [],
        "user_id": user_id,
    }


def get_chat_history(doc_id: str, user_id: str) -> List[Dict]:
    """Return chat history for a document owned by user_id, oldest first."""
    return [
        {
            "id": str(m["_id"]),
            "role": m["role"],
            "content": m["content"],
            "citations": m.get("citations", []),
            "created_at": m.get("created_at"),
        }
        for m in chat_col.find({"doc_id": doc_id, "user_id": user_id})
            .sort("created_at", ASCENDING)
    ]


def delete_chat_history(doc_id: str, user_id: Optional[str] = None) -> bool:
    """Delete chat history (optionally owner-scoped)."""
    query: Dict = {"doc_id": doc_id}
    if user_id:
        query["user_id"] = user_id
    chat_col.delete_many(query)
    return True
