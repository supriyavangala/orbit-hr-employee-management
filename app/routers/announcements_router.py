"""
/api/announcements — a small secondary CRUD entity. Doubles as the data
source for the dashboard banner and the "More > Popups" modal demo, so
that demo shows a real popup with real content instead of lorem ipsum.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.auth import get_current_user, require_role
from app.database import get_db
from app.models import Announcement, RoleEnum, User
from app.schemas import AnnouncementCreate, AnnouncementOut

router = APIRouter(prefix="/api/announcements", tags=["announcements"])


@router.get("", response_model=list[AnnouncementOut])
def list_announcements(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Announcement).order_by(Announcement.created_at.desc()).all()


@router.post("", response_model=AnnouncementOut, status_code=201)
def create_announcement(
    payload: AnnouncementCreate,
    current_user: User = Depends(require_role(RoleEnum.admin, RoleEnum.manager)),
    db: Session = Depends(get_db),
):
    item = Announcement(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    write_audit(db, current_user.id, "CREATE", "Announcement", item.id, item.title)
    return item


@router.delete("/{announcement_id}")
def delete_announcement(
    announcement_id: int,
    current_user: User = Depends(require_role(RoleEnum.admin, RoleEnum.manager)),
    db: Session = Depends(get_db),
):
    item = db.query(Announcement).filter(Announcement.id == announcement_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.delete(item)
    db.commit()
    write_audit(db, current_user.id, "DELETE", "Announcement", announcement_id, item.title)
    return {"message": "Announcement deleted"}