"""
routers/auth.py — signup and login endpoints.

Signup creates a user in MongoDB and returns a JWT immediately (no email
confirmation step). Login verifies the password and returns a JWT.
"""

from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr

from services.auth_service import hash_password, verify_password, create_token
from services.mongo_service import users_col

router = APIRouter(prefix="/auth", tags=["Auth"])


class AuthRequest(BaseModel):
    email: EmailStr
    password: str


@router.post("/signup")
async def signup(req: AuthRequest):
    if len(req.password) < 6:
        raise HTTPException(
            status_code=400, detail="Password must be at least 6 characters."
        )

    if users_col.find_one({"email": req.email}):
        raise HTTPException(
            status_code=409, detail="This email is already registered."
        )

    user_id = str(ObjectId())
    users_col.insert_one({
        "_id": ObjectId(user_id),
        "email": req.email,
        "password_hash": hash_password(req.password),
        "created_at": datetime.now(timezone.utc),
    })

    return {
        "token": create_token(user_id, req.email),
        "user": {"id": user_id, "email": req.email},
    }


@router.post("/login")
async def login(req: AuthRequest):
    user = users_col.find_one({"email": req.email})
    if not user or not verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    user_id = str(user["_id"])
    return {
        "token": create_token(user_id, user["email"]),
        "user": {"id": user_id, "email": user["email"]},
    }
