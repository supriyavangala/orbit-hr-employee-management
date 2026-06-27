"""
/api/users — admin-only user management, surfaced under Settings > Manage Users.

Kept deliberately separate from /api/employees: a User is a login account
with a role, an Employee is an HR record. Real systems often conflate these
and regret it, so this project keeps them distinct on purpose.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.auth import get_current_user, hash_password, require_role
from app.database import get_db
from app.models import RoleEnum, User
from app.schemas import UserCreate, UserOut

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("", response_model=list[UserOut])
def list_users(
    current_user: User = Depends(require_role(RoleEnum.admin)),
    db: Session = Depends(get_db),
):
    return db.query(User).order_by(User.username.asc()).all()


@router.post("", response_model=UserOut, status_code=201)
def create_user(
    payload: UserCreate,
    current_user: User = Depends(require_role(RoleEnum.admin)),
    db: Session = Depends(get_db),
):
    user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Username or email already in use")
    db.refresh(user)
    write_audit(db, current_user.id, "CREATE", "User", user.id, f"Created user {user.username}")
    return user


@router.put("/{user_id}/role", response_model=UserOut)
def change_role(
    user_id: int,
    role: RoleEnum,
    current_user: User = Depends(require_role(RoleEnum.admin)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = role
    db.commit()
    db.refresh(user)
    write_audit(db, current_user.id, "UPDATE", "User", user.id, f"Role changed to {role.value}")
    return user


@router.put("/{user_id}/toggle-active", response_model=UserOut)
def toggle_active(
    user_id: int,
    current_user: User = Depends(require_role(RoleEnum.admin)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot deactivate your own account")
    user.is_active = not user.is_active
    db.commit()
    db.refresh(user)
    write_audit(db, current_user.id, "UPDATE", "User", user.id,
                f"{'Activated' if user.is_active else 'Deactivated'} account")
    return user


@router.delete("/{user_id}")
def delete_user(
    user_id: int,
    current_user: User = Depends(require_role(RoleEnum.admin)),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot delete your own account")
    username = user.username
    db.delete(user)
    db.commit()
    write_audit(db, current_user.id, "DELETE", "User", user_id, f"Deleted user {username}")
    return {"message": f"User {username} deleted"}