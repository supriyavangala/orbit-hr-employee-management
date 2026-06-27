"""
/api/dashboard — aggregate stats for the Home page (counts, department
breakdown, recent hires). All computed with SQL aggregation rather than
pulling every row into Python, so it stays cheap as the table grows.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import get_current_user
from app.database import get_db
from app.models import Employee, EmployeeStatus, User
from app.schemas import DashboardStats, DepartmentCount

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/stats", response_model=DashboardStats)
def stats(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    total = db.query(func.count(Employee.id)).scalar() or 0
    active = db.query(func.count(Employee.id)).filter(Employee.status == EmployeeStatus.active).scalar() or 0
    inactive = total - active
    total_salary = (
        db.query(func.coalesce(func.sum(Employee.salary), 0.0))
        .filter(Employee.status == EmployeeStatus.active)
        .scalar()
    )

    dept_rows = (
        db.query(Employee.department, func.count(Employee.id))
        .group_by(Employee.department)
        .order_by(func.count(Employee.id).desc())
        .all()
    )
    by_department = [DepartmentCount(department=d, count=c) for d, c in dept_rows]

    recent = db.query(Employee).order_by(Employee.created_at.desc()).limit(5).all()

    return DashboardStats(
        total_employees=total,
        active_employees=active,
        inactive_employees=inactive,
        total_monthly_salary=total_salary,
        by_department=by_department,
        recent_hires=recent,
    )