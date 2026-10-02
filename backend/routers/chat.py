from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from services.vector_service import query_document, document_exists
from services.llm_service import generate_answer

# ─── Router Setup ─────────────────────────────────────────────────────────────
router = APIRouter(prefix="/chat", tags=["Chat"])


# ─── Request Schema ───────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    doc_id: str = Field(
        ...,
        description="Document ka unique ID — upload response se milta hai",
        example="550e8400-e29b-41d4-a716-446655440000"
    )
    question: str = Field(
        ...,
        description="User ka natural language question",
        min_length=3,        # 1-2 character questions useless hain
        max_length=500,      # Bahut lamba question bhi context confuse karta hai
        example="What is the main conclusion of this document?"
    )
    n_results: Optional[int] = Field(
        default=6,
        description="Kitne context chunks retrieve karne hain (1-10)",
        ge=1,
        le=10
    )
    # Field() Pydantic ka tool hai jisse:
    # - Validation rules add kar sakte hain (min_length, ge, le)
    # - Swagger docs mein description aur example dikh sakti hai
    # - Default values set kar sakte hain


# ─── Response Schema ──────────────────────────────────────────────────────────
# Response ka bhi schema define karo — Swagger docs mein clearly dikhega
# aur frontend developer ko pata rahega kya expect karna hai
class ChunkInfo(BaseModel):
    text: str
    page_number: int
    similarity_score: float


class ChatResponse(BaseModel):
    success: bool
    answer: str
    citations: List[int]           # Page numbers jo answer mein cite hue
    chunks_used: int
    model: str
    relevant_chunks: List[ChunkInfo]  # Transparency ke liye raw chunks bhi


# ─── Chat Endpoint ────────────────────────────────────────────────────────────
@router.post("/", response_model=ChatResponse)
async def chat_with_document(request: ChatRequest):
    """
    Document ke saath chat karo.

    Complete RAG Pipeline:
    1. ChromaDB mein question se similar chunks dhundo
    2. Chunks ko context mein format karo
    3. Groq LLM se answer generate karo
    4. Answer + citations return karo

    Prerequisites:
    - PDF /upload/ pe upload hona chahiye
    - /ingest/ pe process hona chahiye
    """

    doc_id = request.doc_id
    question = request.question.strip()

    # ── Step 1: Document Ready Hai? ───────────────────────────────────────────
    # Chat se pehle verify karo document ChromaDB mein hai
    # Agar nahi hai toh meaningful error do — "500 internal error" nahi
    if not document_exists(doc_id):
        raise HTTPException(
            status_code=404,
            detail=(
                f"Document '{doc_id}' ChromaDB mein nahi mila. "
                "Pehle /upload/ aur /ingest/ call karein."
            )
        )

    # ── Step 2: Relevant Chunks Retrieve Karo ────────────────────────────────
    # vector_service.query_document() kaam karta hai:
    #   question → embed → cosine similarity search → top n chunks
    try:
        relevant_chunks = query_document(
            doc_id=doc_id,
            question=question,
            n_results=request.n_results
        )
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Document search mein error: {str(e)}"
        )

    # Agar koi relevant chunk nahi mila (empty collection edge case)
    if not relevant_chunks:
        raise HTTPException(
            status_code=404,
            detail="Document mein koi relevant content nahi mila is question ke liye."
        )

    # ── Step 3: LLM Se Answer Generate Karo ──────────────────────────────────
    # llm_service.generate_answer() kaam karta hai:
    #   chunks format karo → system prompt + human message → ChatGroq → answer
    try:
        llm_response = generate_answer(
            question=question,
            relevant_chunks=relevant_chunks
        )
    except Exception as e:
        raise HTTPException(
            status_code=502,   # 502 = Bad Gateway — upstream service (Groq) ne error diya
            detail=f"LLM answer generate karne mein error: {str(e)}"
        )

    # ── Step 4: Response Format Karo ─────────────────────────────────────────
    # ChunkInfo objects banao response schema ke liye
    chunks_info = [
        ChunkInfo(
            text=chunk["text"],
            page_number=chunk.get("page_number", 0),
            similarity_score=chunk.get("similarity_score", 0.0)
        )
        for chunk in relevant_chunks
    ]

    return ChatResponse(
        success=True,
        answer=llm_response["answer"],
        citations=llm_response["citations"],
        chunks_used=llm_response["chunks_used"],
        model=llm_response["model"],
        relevant_chunks=chunks_info
    )


# ─── Quick Question (Simpler Interface) ──────────────────────────────────────
# Kabhi kabhi frontend ko simple GET request se quick answer chahiye hota hai
# Yeh optional convenience endpoint hai — same logic, query params se kaam karta hai
@router.get("/quick")
async def quick_chat(doc_id: str, question: str):
    """
    GET request se quick question poochho.

    Usage: GET /chat/quick?doc_id=abc-123&question=What+is+this+about

    POST /chat/ se fark: yeh simplified response deta hai,
    raw chunks include nahi karta.
    """

    if not document_exists(doc_id):
        raise HTTPException(
            status_code=404,
            detail=f"Document '{doc_id}' nahi mila. Pehle upload aur ingest karein."
        )

    relevant_chunks = query_document(
        doc_id=doc_id,
        question=question.strip(),
        n_results=4
    )

    if not relevant_chunks:
        return {
            "answer": "Is question ka jawab document mein nahi mila.",
            "citations": []
        }

    llm_response = generate_answer(
        question=question.strip(),
        relevant_chunks=relevant_chunks
    )

    # Simplified response — sirf answer aur citations
    return {
        "answer": llm_response["answer"],
        "citations": llm_response["citations"]
    }
