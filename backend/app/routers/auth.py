"""
Registration and login endpoints. Login verifies the password against the
database (every time) and returns a JWT; every other route after that uses
the token instead of asking for the password again.
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.auth import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    name: str
    email: str


@router.post("/register", response_model=TokenResponse)
def register(request: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(400, "An account with this email already exists.")

    import re
    if len(request.password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters.")
    if not re.search(r"[A-Z]", request.password):
        raise HTTPException(400, "Password must contain at least one uppercase letter.")
    if not re.search(r"[a-z]", request.password):
        raise HTTPException(400, "Password must contain at least one lowercase letter.")
    if not re.search(r"\d", request.password):
        raise HTTPException(400, "Password must contain at least one number.")
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", request.password):
        raise HTTPException(400, "Password must contain at least one special character.")
    if not request.name.strip():
        raise HTTPException(400, "Name is required.")

    user = User(
        name=request.name.strip(),
        email=request.email,
        hashed_password=hash_password(request.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(401, "Incorrect email or password.")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return UserResponse(id=current_user.id, name=current_user.name, email=current_user.email)
