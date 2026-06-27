"""
/api/auth — login, "who am I", change password, theme preference.

Login is the one endpoint that uses OAuth2PasswordRequestForm (username +
password as form fields) because that's what FastAPI's built-in /docs
"Authorize" button and OAuth2PasswordBearer expect. Every other endpoint in
the app talks JSON.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.auth import create_access_token, get_current_user, hash_password, verify_password
from app.database import get_db
from app.models import User
from app.schemas import PasswordChange, ThemeUpdate, Token, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Incorrect username or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This account has been disabled")

    token = create_access_token({"sub": user.username, "role": user.role.value})
    write_audit(db, user.id, "LOGIN", "User", user.id, f"{user.username} logged in")
    return Token(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/change-password")
def change_password(
    payload: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if payload.current_password == payload.new_password:
        raise HTTPException(status_code=400, detail="New password must differ from current password")

    current_user.hashed_password = hash_password(payload.new_password)
    db.commit()
    write_audit(db, current_user.id, "UPDATE", "User", current_user.id, "Password changed")
    return {"message": "Password updated successfully"}


@router.put("/theme", response_model=UserOut)
def update_theme(
    payload: ThemeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_user.theme = payload.theme
    db.commit()
    db.refresh(current_user)
    return current_user