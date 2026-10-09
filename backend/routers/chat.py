from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from typing import List, Optional

from services.vector_service import query_document, document_exists
from services.llm_service import generate_answer
from services.supabase_service import insert_chat_message, get_chat_history
from services.auth_service import get_user_id

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
async def chat_with_document(
    request: ChatRequest,
    user_id: str = Depends(get_user_id),   # ← Auth required
):
    """
    Full RAG pipeline with auth:
    1. Document user ka hai verify karo
    2. pgvector se relevant chunks retrieve karo
    3. Groq LLM se answer generate karo
    4. Messages user_id ke saath save karo
    """
    doc_id   = request.doc_id
    question = request.question.strip()

    if not document_exists(doc_id):
        raise HTTPException(
            status_code=404,
            detail="Document nahi mila ya process nahi hua."
        )

    try:
        relevant_chunks = query_document(doc_id, question, request.n_results)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Search error: {str(e)}")

    if not relevant_chunks:
        raise HTTPException(
            status_code=404,
            detail="Is question ke liye relevant content nahi mila."
        )

    try:
        llm_response = generate_answer(question, relevant_chunks)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"LLM error: {str(e)}")

    # Messages save — user_id ke saath
    try:
        insert_chat_message(doc_id, "user", question, user_id)
    except Exception as e:
        print(f"Warning: user message save failed: {e}")

    try:
        insert_chat_message(
            doc_id, "assistant",
            llm_response["answer"],
            user_id,
            llm_response["citations"],
        )
    except Exception as e:
        print(f"Warning: assistant message save failed: {e}")

    return ChatResponse(
        success=True,
        answer=llm_response["answer"],
        citations=llm_response["citations"],
        chunks_used=llm_response["chunks_used"],
        model=llm_response["model"],
        relevant_chunks=[
            ChunkInfo(
                text=c["text"],
                page_number=c.get("page_number", 0),
                similarity_score=c.get("similarity_score", 0.0),
            )
            for c in relevant_chunks
        ],
    )


@router.get("/history/{doc_id}")
async def get_document_chat_history(
    doc_id: str,
    user_id: str = Depends(get_user_id),
):
    """
    Chat history fetch karo — sirf is user ki messages.
    """
    try:
        messages = get_chat_history(doc_id, user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"History error: {str(e)}")

    return {
        "doc_id":   doc_id,
        "messages": messages,
        "count":    len(messages),
    }
