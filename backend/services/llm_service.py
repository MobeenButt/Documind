import os
from typing import List, Dict

from langchain_groq import ChatGroq
from langchain_core.messages import SystemMessage, HumanMessage

# ─── LLM Client ───────────────────────────────────────────────────────────────
# ChatGroq globally initialize karo — har request pe naya client banana wasteful hai.
# api_key=None → automatically GROQ_API_KEY environment variable se utha lega
#                (load_dotenv() main.py mein pehle hi call ho chuki hai)
# model: llama-3.3-70b-versatile — powerful, fast, Groq ke free tier mein available
# temperature: 0 se 1 ke beech
#   0   = deterministic (har baar same answer) — facts ke liye best
#   0.7 = creative (thoda variation) — creative writing ke liye
#   Hum 0.1 use karenge — mostly factual lekin thodi natural language variation
# max_tokens: response ki maximum length
#   1024 tokens ≈ 750-800 words — document Q&A ke liye kaafi hai
llm = ChatGroq(
    api_key=os.getenv("GROQ_API_KEY"),
    model="openai/gpt-oss-120b",
    temperature=0.1,
    max_tokens=800,   # qwen ka limit 1000 tha, gpt-oss-120b pe safe value
)


# ─── Context Formatter ────────────────────────────────────────────────────────
def format_context(relevant_chunks: List[Dict]) -> str:
    """
    vector_service.query_document() ke output ko
    LLM ke liye readable context string mein convert karo.

    Input:
        [
            {"text": "Einstein...", "page_number": 3, "similarity_score": 0.92},
            {"text": "E=mc²...",    "page_number": 7, "similarity_score": 0.87},
        ]

    Output:
        "[Page 3]: Einstein ne 1905 mein...

         [Page 7]: E=mc² formula..."
    """

    # Chunks ko similarity score ke hisaab se sort karo (highest first)
    # Sabse relevant chunk pehle aaye — LLM shuru ka context zyada dhyan se padhta hai
    sorted_chunks = sorted(
        relevant_chunks,
        key=lambda x: x["similarity_score"],
        reverse=True
    )

    context_parts = []
    for chunk in sorted_chunks:
        page_num = chunk.get("page_number", "unknown")
        text = chunk.get("text", "").strip()

        # Format: [Page X]: text
        # Square brackets LLM ke liye clear marker hain — parsing easy hoti hai
        context_parts.append(f"[Page {page_num}]: {text}")

    # Double newline se chunks alag alag clearly dikhte hain
    return "\n\n".join(context_parts)


# ─── Generate Answer ──────────────────────────────────────────────────────────
def generate_answer(question: str, relevant_chunks: List[Dict]) -> Dict:
    """
    User ke question ka answer generate karo retrieved chunks ke basis pe.

    Args:
        question: User ka natural language question
        relevant_chunks: vector_service.query_document() ka output

    Returns:
        {
            "answer": "...",           # LLM ka answer
            "citations": [3, 7],       # Pages jo answer mein use hue
            "chunks_used": 4,          # Kitne context chunks the
            "model": "llama-3.3-70b"   # Konsa model use hua
        }
    """

    # ── Step 1: Context Format Karo ───────────────────────────────────────────
    context = format_context(relevant_chunks)

    # Page numbers collect karo — citations ke liye
    # set() duplicates remove karta hai, sorted() order mein rakhta hai
    page_numbers = sorted(set(
        chunk.get("page_number", 0)
        for chunk in relevant_chunks
        if chunk.get("page_number")
    ))

    # ── Step 2: System Prompt ─────────────────────────────────────────────────
    # System prompt LLM ka persona aur rules define karta hai.
    # Rules clear likhne chahiye — vague instructions = vague behavior.
    system_prompt = """You are DocuMind, an AI assistant that answers questions about uploaded documents.

You are given relevant excerpts from the document as context. Use this context to answer the user's question as helpfully as possible.

Rules:
1. Base your answer primarily on the provided context
2. If the context covers the topic partially, give the best answer you can from what is available
3. Mention page numbers where relevant — format: (Page X)
4. Only say "information not found" if the context has absolutely no relation to the question
5. Keep answers clear and concise
6. If multiple pages contribute to the answer, cite all of them"""

    # ── Step 3: Human Message (Context + Question) ────────────────────────────
    # Context inject karna hi RAG ka core hai.
    # LLM ne PDF nahi padha — yeh chunks hi uski "knowledge" hain is moment ke liye.
    human_message = f"""Document Context:
{context}

---

Question: {question}

Answer based on the context above. Cite page numbers where relevant."""

    # ── Step 4: LLM Call ──────────────────────────────────────────────────────
    # Messages list banao — order matter karta hai:
    # SystemMessage pehle → HumanMessage baad mein
    messages = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=human_message)
    ]

    # invoke() synchronous call hai — response aane tak wait karega
    # .content → AIMessage object se actual text string nikalo
    response = llm.invoke(messages)
    answer_text = response.content

    # ── Step 5: Response Package ──────────────────────────────────────────────
    return {
        "answer": answer_text,
        "citations": page_numbers,      # [3, 7] — kaunse pages context mein the
        "chunks_used": len(relevant_chunks),
        "model": "openai/gpt-oss-120b"
    }


# ─── Health Check for LLM ─────────────────────────────────────────────────────
def check_llm_connection() -> Dict:
    """
    Groq API connection test karo.
    Server startup pe ya /health endpoint se call ho sakta hai.
    """
    try:
        # Ek chhota test message bhejo
        test_response = llm.invoke([
            HumanMessage(content="Reply with just the word: OK")
        ])
        return {
            "status": "connected",
            "model": "openai/gpt-oss-120b",
            "test_response": test_response.content.strip()
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }
