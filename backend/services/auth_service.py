"""
auth_service.py — JWT Token Verification

Concept: Kaise authentication kaam karta hai?

1. User frontend pe login karta hai (email + password)
2. Supabase ek JWT token return karta hai
   JWT = JSON Web Token — ek encoded string jisme user ki info hoti hai
   Example: "eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoiYWJjIn0.xyz"

3. Frontend har API request ke saath yeh token bhejta hai:
   Header: Authorization: Bearer eyJhbGciOiJ...

4. Backend token verify karta hai:
   - Valid hai? (tampered nahi hua?)
   - Expire nahi hua?
   - Supabase ne issue kiya tha?

5. Token valid hai toh user_id extract karo aur request process karo.

Service Role Key vs JWT:
- Service role key = backend ka master key (RLS bypass karta hai)
- JWT = user ka personal token (RLS enforce hoti hai)
- Humara backend service role se DB operations karta hai
  lekin user_id JWT se extract karke manually filter lagata hai
"""

import os
import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional

# HTTPBearer FastAPI ka built-in security scheme hai
# Yeh Authorization header se "Bearer <token>" extract karta hai
security = HTTPBearer()

# Supabase JWT secret — token verify karne ke liye
# Supabase Dashboard → Settings → API → JWT Secret
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    JWT token verify karo aur user info return karo.

    FastAPI dependency injection se use hota hai:
        @router.post("/")
        async def endpoint(user = Depends(verify_token)):
            user_id = user["sub"]

    "sub" = subject = user ka unique ID (UUID)
    Yeh Supabase ka standard JWT claim hai.
    """
    token = credentials.credentials

    try:
        # jwt.decode() token ko verify + decode karta hai
        # algorithms=["HS256"] — Supabase HS256 algorithm use karta hai
        # options={"verify_aud": False} — audience check skip karo
        #   (Supabase ke tokens mein audience "authenticated" hota hai
        #    lekin hum sirf user_id chahiye, audience verify ki zaroorat nahi)
        payload = jwt.decode(
            token,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
        return payload

    except jwt.ExpiredSignatureError:
        # Token ka expiry time guzar gaya — user ko dobara login karna hoga
        raise HTTPException(
            status_code=401,
            detail="Session expire ho gayi. Dobara login karein."
        )

    except jwt.InvalidTokenError as e:
        # Token tampered hua ya invalid hai
        raise HTTPException(
            status_code=401,
            detail=f"Invalid token: {str(e)}"
        )


def get_user_id(credentials: HTTPAuthorizationCredentials = Security(security)) -> str:
    """
    Shortcut — sirf user_id string return karo.
    Most endpoints mein sirf yahi chahiye.

    Usage:
        @router.post("/")
        async def endpoint(user_id: str = Depends(get_user_id)):
            # user_id ready to use
    """
    payload = verify_token(credentials)
    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(
            status_code=401,
            detail="Token mein user ID nahi mili."
        )

    return user_id


def get_optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Security(HTTPBearer(auto_error=False))
) -> Optional[str]:
    """
    Optional auth — token hai toh verify karo, nahi hai toh None return karo.
    Public endpoints ke liye jahan auth optional ho.
    """
    if not credentials:
        return None
    try:
        payload = jwt.decode(
            credentials.credentials,
            SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False}
        )
        return payload.get("sub")
    except Exception:
        return None
