from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import List, Optional

from services.vector_service import query_document, document_exists
from services.llm_service import generate_answer
from services.supabase_service import insert_chat_message, get_chat_history

router = APIRouter(prefix="/chat", tags=["Chat"])


class ChatRequest(BaseModel):
    doc_id:    str
    question:  str   = Field(..., min_length=3, max_length=500)
    n_results: Optional[int] = Field(default=6, ge=1, le=10)


class ChunkInfo(BaseModel):
    text:             str
    page_number:      int
    similarity_score: float


class ChatResponse(BaseModel):
    success:         bool
    answer:          str
    citations:       List[int]
    chunks_used:     int
    model:           str
    relevant_chunks: List[ChunkInfo]


@router.post("/", response_model=ChatResponse)
async def chat_with_document(request: ChatRequest):
    """
    Full RAG pipeline:
    1. pgvector se relevant chunks retrieve karo
    2. Groq LLM se answer generate karo
    3. User + assistant messages Supabase mein save karo
    """
    doc_id   = request.doc_id
    question = request.question.strip()

    # ── Document check ────────────────────────────────────────────────────────
    if not document_exists(doc_id):
        raise HTTPException(
            status_code=404,
            detail=f"Document '{doc_id}' nahi mila. Pehle upload aur ingest karein."
        )

    # ── Retrieve relevant chunks ──────────────────────────────────────────────
    try:
        relevant_chunks = query_document(doc_id, question, request.n_results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")

    if not relevant_chunks:
        raise HTTPException(
            status_code=404,
            detail="Relevant content nahi mila is question ke liye."
        )

    # ── Generate answer ───────────────────────────────────────────────────────
    try:
        llm_response = generate_answer(question, relevant_chunks)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {str(e)}")

    # ── Save both messages to Supabase ────────────────────────────────────────
    # User message
    try:
        insert_chat_message(doc_id=doc_id, role="user", content=question)
    except Exception as e:
        print(f"Warning: user message save failed: {e}")

    # Assistant message with citations
    try:
        insert_chat_message(
            doc_id=doc_id,
            role="assistant",
            content=llm_response["answer"],
            citations=llm_response["citations"],
        )
    except Exception as e:
        print(f"Warning: assistant message save failed: {e}")

    chunks_info = [
        ChunkInfo(
            text=c["text"],
            page_number=c.get("page_number", 0),
            similarity_score=c.get("similarity_score", 0.0),
        )
        for c in relevant_chunks
    ]

    return ChatResponse(
        success=True,
        answer=llm_response["answer"],
        citations=llm_response["citations"],
        chunks_used=llm_response["chunks_used"],
        model=llm_response["model"],
        relevant_chunks=chunks_info,
    )


@router.get("/history/{doc_id}")
async def get_document_chat_history(doc_id: str):
    """
    Document ki poori chat history return karo.
    Frontend ChatPage load hone pe yeh call karta hai.
    """
    try:
        messages = get_chat_history(doc_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"History fetch error: {str(e)}")

    return {
        "doc_id":   doc_id,
        "messages": messages,
        "count":    len(messages),
    }
