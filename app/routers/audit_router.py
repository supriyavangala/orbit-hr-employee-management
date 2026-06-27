"""
/api/audit-logs — read-only trail, surfaced under Settings > Activity Log.
Admin/Manager only: this is who-did-what-when, not for general staff viewing.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.auth import require_role
from app.database import get_db
from app.models import AuditLog, RoleEnum, User
from app.schemas import AuditLogOut

router = APIRouter(prefix="/api/audit-logs", tags=["audit"])


@router.get("", response_model=list[AuditLogOut])
def list_audit_logs(
    limit: int = Query(50, ge=1, le=500),
    current_user: User = Depends(require_role(RoleEnum.admin, RoleEnum.manager)),
    db: Session = Depends(get_db),
):
    rows = db.query(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit).all()
    result = []
    for r in rows:
        result.append(
            AuditLogOut(
                id=r.id,
                action=r.action,
                entity_type=r.entity_type,
                entity_id=r.entity_id,
                details=r.details,
                timestamp=r.timestamp,
                actor_username=r.actor.username if r.actor else None,
            )
        )
    return result