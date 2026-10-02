import os
from typing import List, Dict, Tuple

# LangChain v0.2+ mein text splitters alag package mein move ho gaye
from langchain_text_splitters import RecursiveCharacterTextSplitter
from sentence_transformers import SentenceTransformer
import chromadb

# ─── Embedding Model ──────────────────────────────────────────────────────────
print("Embedding model load ho raha hai...")
embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
print("Embedding model ready!")

# ─── ChromaDB Client ──────────────────────────────────────────────────────────
CHROMA_PATH = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "chroma_db")
)
chroma_client = chromadb.PersistentClient(path=CHROMA_PATH)


# ─── Document Analyzer ────────────────────────────────────────────────────────
def analyze_document(pages_data: List[Dict]) -> Dict:
    """
    Document ko automatically analyze karo aur best chunking strategy decide karo.

    Tum document open nahi kar sakte — toh yeh function extracted text ke stats
    se document ki nature samajhta hai aur settings suggest karta hai.

    Returns:
        {
            "doc_type": "slides" | "book" | "report" | "mixed",
            "avg_page_length": 342,
            "chunk_size": 600,
            "chunk_overlap": 100,
            "min_merge_length": 200,
            "stats": { ... }   # debug ke liye
        }
    """

    if not pages_data:
        # Fallback defaults agar koi data nahi
        return {"doc_type": "unknown", "chunk_size": 1000, "chunk_overlap": 150, "min_merge_length": 300}

    # ── Calculate Stats ───────────────────────────────────────────────────────
    page_lengths = [len(p["text"]) for p in pages_data]

    avg_len    = sum(page_lengths) / len(page_lengths)
    max_len    = max(page_lengths)
    min_len    = min(page_lengths)
    total_text = sum(page_lengths)

    # Kitne pages "chhote" hain (< 300 chars) — slides indicator
    short_pages = sum(1 for l in page_lengths if l < 300)
    short_ratio = short_pages / len(page_lengths)  # 0.0 to 1.0

    # ── Classify Document Type ────────────────────────────────────────────────
    #
    # SLIDES:  avg page < 400 chars, bahut saare short pages
    #          → chhote chunk size, aggressive merging
    #
    # BOOK:    avg page > 1500 chars, few short pages
    #          → bade chunks, zyada overlap
    #
    # REPORT:  avg page 400-1500, mix of lengths
    #          → medium chunks
    #
    # MIXED:   short_ratio > 0.5 but avg not too low
    #          → conservative medium settings

    if avg_len < 400 or short_ratio > 0.6:
        doc_type      = "slides"
        chunk_size    = 600
        chunk_overlap = 100
        min_merge_len = 200   # Is se chhota page = agla page ke saath merge

    elif avg_len > 1500 and short_ratio < 0.2:
        doc_type      = "book"
        chunk_size    = 1500
        chunk_overlap = 200
        min_merge_len = 500

    elif short_ratio > 0.4:
        doc_type      = "mixed"
        chunk_size    = 800
        chunk_overlap = 120
        min_merge_len = 300

    else:
        doc_type      = "report"
        chunk_size    = 1000
        chunk_overlap = 150
        min_merge_len = 300

    return {
        "doc_type": doc_type,
        "chunk_size": chunk_size,
        "chunk_overlap": chunk_overlap,
        "min_merge_length": min_merge_len,
        "stats": {
            "total_pages": len(pages_data),
            "avg_page_length": round(avg_len),
            "max_page_length": max_len,
            "min_page_length": min_len,
            "short_pages_ratio": round(short_ratio, 2),
            "total_characters": total_text
        }
    }


# ─── Text Splitter Factory ────────────────────────────────────────────────────
def make_splitter(chunk_size: int, chunk_overlap: int) -> RecursiveCharacterTextSplitter:
    """
    Diye gaye settings ke saath naya text splitter banao.
    Pehle ek global splitter tha — ab har document ke liye
    uski nature ke hisaab se splitter banta hai.
    """
    return RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        length_function=len,
        separators=["\n\n", "\n", " ", ""]
    )


# ─── Ingest Document ──────────────────────────────────────────────────────────
def ingest_document(doc_id: str, pages_data: List[Dict]) -> Dict:
    """
    PDF ke extracted pages ko ChromaDB mein store karo.
    Automatically document analyze karta hai aur best chunking strategy apply karta hai.
    """

    # ── Step 0: Auto-Analyze Document ────────────────────────────────────────
    # Document khud batata hai kaisa hai — tum dekhne ki zaroorat nahi
    analysis = analyze_document(pages_data)

    doc_type      = analysis["doc_type"]
    chunk_size    = analysis["chunk_size"]
    chunk_overlap = analysis["chunk_overlap"]
    min_merge_len = analysis["min_merge_length"]

    print(f"  Document type detected: {doc_type}")
    print(f"  Chunk size: {chunk_size} | Overlap: {chunk_overlap} | Min merge: {min_merge_len}")
    print(f"  Stats: {analysis['stats']}")

    # Is document ke liye specific splitter banao
    text_splitter = make_splitter(chunk_size, chunk_overlap)

    # ── Step 1: Page Merging + Chunking ──────────────────────────────────────
    all_chunks = []
    all_texts  = []

    # Chhote pages ko unke neighbors ke saath merge karo
    # Slides/sparse PDFs mein yeh zaroori hai — warna 2-line chunks bante hain
    merged_windows = []
    buffer_text = ""
    buffer_page = None

    for page in pages_data:
        page_text = page["text"].strip()
        page_num  = page["page_number"]

        if not buffer_text:
            buffer_text = page_text
            buffer_page = page_num
        else:
            if len(buffer_text) < min_merge_len:
                # Buffer abhi chhota hai — merge karo
                buffer_text += "\n\n" + page_text
            else:
                # Buffer kaafi bada — save karo, naya shuru karo
                merged_windows.append({"page_number": buffer_page, "text": buffer_text})
                buffer_text = page_text
                buffer_page = page_num

    if buffer_text:
        merged_windows.append({"page_number": buffer_page, "text": buffer_text})

    # Merged windows ko chunks mein todo
    for window in merged_windows:
        chunks = text_splitter.create_documents(
            texts=[window["text"]],
            metadatas=[{"page_number": window["page_number"], "doc_id": doc_id}]
        )
        for i, chunk in enumerate(chunks):
            chunk_id = f"{doc_id}_page{window['page_number']}_chunk{i}"
            all_chunks.append({
                "id": chunk_id,
                "text": chunk.page_content,
                "metadata": chunk.metadata
            })
            all_texts.append(chunk.page_content)

    if not all_chunks:
        raise ValueError("Koi bhi chunk nahi bana — PDF blank ho sakta hai")

    # ── Step 2: Embeddings ────────────────────────────────────────────────────
    # encode() texts ki list leta hai aur numpy array return karta hai
    # shape: (num_chunks, 384) — 384 dimensions per chunk
    # show_progress_bar=True terminal mein progress dikhata hai
    embeddings = embedding_model.encode(
        all_texts,
        show_progress_bar=True,
        convert_to_numpy=True
    )

    # ── Step 3: ChromaDB Collection ───────────────────────────────────────────
    # Har document ki apni collection hoti hai.
    # get_or_create_collection = agar exist kare toh lo, nahi toh banao.
    # Collection name = doc_id (unique guarantee hai)
    collection = chroma_client.get_or_create_collection(
        name=doc_id,
        # cosine similarity = text similarity ke liye best
        # Dusre options: l2 (Euclidean distance), ip (inner product)
        metadata={"hnsw:space": "cosine"}
    )

    # ── Step 4: Data Store ────────────────────────────────────────────────────
    # collection.add() ek saath sab kuch store karta hai.
    # ids       → har chunk ka unique string ID
    # documents → actual text (retrieval ke waqt return hoga)
    # embeddings → numpy array → ChromaDB list mein convert kar leta hai
    # metadatas  → page_number etc. (filtering ke liye use ho sakti hai)
    collection.add(
        ids=[c["id"] for c in all_chunks],
        documents=[c["text"] for c in all_chunks],
        embeddings=embeddings.tolist(),    # numpy array → Python list
        metadatas=[c["metadata"] for c in all_chunks]
    )

    return {
        "doc_id": doc_id,
        "doc_type": analysis["doc_type"],
        "total_chunks": len(all_chunks),
        "chunk_size_used": chunk_size,
        "chunk_overlap_used": chunk_overlap,
        "stats": analysis["stats"],
        "message": f"{len(all_chunks)} chunks stored. Document type: {doc_type}."
    }


# ─── Query Document ───────────────────────────────────────────────────────────
def query_document(doc_id: str, question: str, n_results: int = 4) -> List[Dict]:
    """
    User ke question ke liye document mein se relevant chunks dhundo.

    Args:
        doc_id: Kis document mein search karna hai
        question: User ka natural language question
        n_results: Kitne chunks return karne hain (default 4)

    Returns:
        List of relevant chunks with text and page numbers
    """

    # ── Step 1: Question Embed Karo ───────────────────────────────────────────
    # Question ko bhi same model se embed karo jisse chunks embed kiye the.
    # Same model = same vector space = comparable distances.
    query_embedding = embedding_model.encode(question, convert_to_numpy=True)

    # ── Step 2: Collection Lo ─────────────────────────────────────────────────
    try:
        collection = chroma_client.get_collection(name=doc_id)
    except Exception:
        # Agar collection exist nahi karta matlab document ingest nahi hua
        raise ValueError(f"Document '{doc_id}' ChromaDB mein nahi mila. Pehle ingest karo.")

    # ── Step 3: Similarity Search ─────────────────────────────────────────────
    # query_embeddings = list of query vectors (hum ek hi query kar rahe hain)
    # n_results = kitne closest chunks chahiye
    # include = response mein kya kya include karo
    results = collection.query(
        query_embeddings=[query_embedding.tolist()],
        n_results=n_results,
        include=["documents", "metadatas", "distances"]
        # distances = similarity score (0 = identical, 2 = completely different in cosine space)
    )

    # ── Step 4: Results Format Karo ───────────────────────────────────────────
    # ChromaDB nested lists return karta hai (kyunki multiple queries possible hain)
    # results["documents"][0] = pehli query ke documents
    relevant_chunks = []

    for i, doc_text in enumerate(results["documents"][0]):
        metadata = results["metadatas"][0][i]
        distance = results["distances"][0][i]

        # Cosine distance ko similarity score mein convert karo
        # distance 0 = exact match → similarity 1.0
        # distance 2 = opposite   → similarity 0.0
        similarity_score = round(1 - (distance / 2), 3)

        relevant_chunks.append({
            "text": doc_text,
            "page_number": metadata.get("page_number", "unknown"),
            "similarity_score": similarity_score,
            "chunk_index": i + 1  # 1-based for readability
        })

    return relevant_chunks


# ─── Delete Document ──────────────────────────────────────────────────────────
def delete_document(doc_id: str) -> bool:
    """
    Document ki collection ChromaDB se delete karo.
    Useful jab user document remove karna chahe.
    """
    try:
        chroma_client.delete_collection(name=doc_id)
        return True
    except Exception:
        return False


# ─── Document Exists Check ────────────────────────────────────────────────────
def document_exists(doc_id: str) -> bool:
    """
    Check karo kya document already ChromaDB mein ingest hua hai.
    Double-ingestion se bachne ke liye use hoga.
    """
    try:
        chroma_client.get_collection(name=doc_id)
        return True
    except Exception:
        return False
