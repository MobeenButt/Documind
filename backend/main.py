from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="DocuMind API",description="Chat with your documents using AI!" ,
version="1.0.0")

# CORS — React frontend ke liye
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Health Check ────────────────────────────
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "message": "DocuMind API is running! 🚀",
        "groq_key_set": bool(os.getenv("GROQ_API_KEY"))
    }

# ─── Root ────────────────────────────────────
@app.get("/")
def root():
    return {
        "app": "DocuMind",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }