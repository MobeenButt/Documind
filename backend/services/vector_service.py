import os
from typing import List, Dict

from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer

# ChromaDB hata diya — Supabase pgvector use karo
from services.supabase_service import (
    insert_embeddings,
    search_embeddings,
    delete_embeddings,
    embeddings_exist,
)

# ─── Embedding Model ──────────────────────────────────────────────────────────
print("Embedding model load ho raha hai...")
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
print("Embedding model ready!")


# ─── Document Analyzer ────────────────────────────────────────────────────────
def analyze_document(pages_data: List[Dict]) -> Dict:
    """
    Document stats se automatically best chunking strategy decide karo.
    Tum PDF open nahi karte — numbers khud baat karte hain.
    """
    if not pages_data:
        return {
            "doc_type": "unknown",
            "chunk_size": 1000,
            "chunk_overlap": 150,
            "min_merge_length": 300,
            "stats": {}
        }

    page_lengths = [len(p["text"]) for p in pages_data]
    avg_len      = sum(page_lengths) / len(page_lengths)
    max_len      = max(page_lengths)
    min_len      = min(page_lengths)
    total_text   = sum(page_lengths)
    short_pages  = sum(1 for l in page_lengths if l < 300)
    short_ratio  = short_pages / len(page_lengths)

    if avg_len < 400 or short_ratio > 0.6:
        doc_type, chunk_size, chunk_overlap, min_merge_len = "slides",  600,  100, 200
    elif avg_len > 1500 and short_ratio < 0.2:
        doc_type, chunk_size, chunk_overlap, min_merge_len = "book",   1500,  200, 500
    elif short_ratio > 0.4:
        doc_type, chunk_size, chunk_overlap, min_merge_len = "mixed",   800,  120, 300
    else:
        doc_type, chunk_size, chunk_overlap, min_merge_len = "report", 1000,  150, 300

    return {
        "doc_type":        doc_type,
        "chunk_size":      chunk_size,
        "chunk_overlap":   chunk_overlap,
        "min_merge_length": min_merge_len,
        "stats": {
            "total_pages":       len(pages_data),
            "avg_page_length":   round(avg_len),
            "max_page_length":   max_len,
            "min_page_length":   min_len,
            "short_pages_ratio": round(short_ratio, 2),
            "total_characters":  total_text,
        }
    }


# ─── Text Splitter Factory ────────────────────────────────────────────────────
def make_splitter(chunk_size: int, chunk_overlap: int) -> RecursiveCharacterTextSplitter:
    return RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )


# ─── Ingest Document ──────────────────────────────────────────────────────────
def ingest_document(doc_id: str, pages_data: List[Dict]) -> Dict:
    """
    PDF pages ko chunk karo, embed karo, aur Supabase pgvector mein store karo.
    ChromaDB ki jagah ab pgvector use ho raha hai.
    """

    # ── Step 0: Analyze ───────────────────────────────────────────────────────
    analysis     = analyze_document(pages_data)
    doc_type     = analysis["doc_type"]
    chunk_size   = analysis["chunk_size"]
    chunk_overlap = analysis["chunk_overlap"]
    min_merge_len = analysis["min_merge_length"]

    print(f"  Doc type: {doc_type} | chunk_size: {chunk_size} | overlap: {chunk_overlap}")

    text_splitter = make_splitter(chunk_size, chunk_overlap)

    # ── Step 1: Page Merging + Chunking ───────────────────────────────────────
    all_chunks = []
    all_texts  = []

    merged_windows = []
    buffer_text = ""
    buffer_page = None

    for page in pages_data:
        page_text = page["text"].strip()
        page_num  = page["page_number"]

        if not buffer_text:
            buffer_text = page_text
            buffer_page = page_num
        elif len(buffer_text) < min_merge_len:
            buffer_text += "\n\n" + page_text
        else:
            merged_windows.append({"page_number": buffer_page, "text": buffer_text})
            buffer_text = page_text
            buffer_page = page_num

    if buffer_text:
        merged_windows.append({"page_number": buffer_page, "text": buffer_text})

    for window in merged_windows:
        chunks = text_splitter.create_documents(
            texts=[window["text"]],
            metadatas=[{"page_number": window["page_number"]}]
        )
        for i, chunk in enumerate(chunks):
            all_chunks.append({
                "chunk_text":  chunk.page_content,
                "page_number": window["page_number"],
                "chunk_index": i,
            })
            all_texts.append(chunk.page_content)

    if not all_chunks:
        raise ValueError("Koi chunk nahi bana — PDF blank ho sakta hai")

    # ── Step 2: Embeddings ────────────────────────────────────────────────────
    print(f"  Generating embeddings for {len(all_texts)} chunks...")
    embeddings = embedding_model.encode(
        all_texts,
        show_progress_bar=True,
        convert_to_numpy=True
    )

    # ── Step 3: Supabase pgvector mein store karo ─────────────────────────────
    # Har chunk mein embedding list attach karo
    chunks_with_embeddings = []
    for i, chunk in enumerate(all_chunks):
        chunks_with_embeddings.append({
            **chunk,
            "embedding": embeddings[i].tolist()   # numpy array → Python list
        })

    print(f"  Storing {len(chunks_with_embeddings)} chunks in Supabase pgvector...")
    inserted = insert_embeddings(doc_id, chunks_with_embeddings)
    print(f"  Stored {inserted} chunks.")

    return {
        "doc_id":           doc_id,
        "doc_type":         doc_type,
        "total_chunks":     len(all_chunks),
        "chunk_size_used":  chunk_size,
        "chunk_overlap_used": chunk_overlap,
        "stats":            analysis["stats"],
        "message":          f"{len(all_chunks)} chunks stored in Supabase pgvector. Type: {doc_type}."
    }


# ─── Query Document ───────────────────────────────────────────────────────────
def query_document(doc_id: str, question: str, n_results: int = 6) -> List[Dict]:
    """
    User ke question ke liye pgvector mein similarity search karo.
    ChromaDB ki jagah Supabase RPC function use hota hai.
    """

    # Question embed karo
    query_embedding = embedding_model.encode(question, convert_to_numpy=True)

    # Supabase match_embeddings() RPC call
    results = search_embeddings(
        doc_id=doc_id,
        query_embedding=query_embedding.tolist(),
        n_results=n_results
    )

    # Format karo — same structure jo llm_service expect karta hai
    relevant_chunks = []
    for item in results:
        relevant_chunks.append({
            "text":             item["chunk_text"],
            "page_number":      item["page_number"],
            "similarity_score": round(float(item["similarity"]), 3),
        })

    return relevant_chunks


# ─── Document Exists ──────────────────────────────────────────────────────────
def document_exists(doc_id: str) -> bool:
    """Check karo kya document ke embeddings Supabase mein hain."""
    return embeddings_exist(doc_id)


# ─── Delete Document ──────────────────────────────────────────────────────────
def delete_document(doc_id: str) -> bool:
    """Document ke embeddings delete karo."""
    return delete_embeddings(doc_id)
