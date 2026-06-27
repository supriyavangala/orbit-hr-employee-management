"""
/api/employees — the core CRUD module (mirrors the reference app's "Employee" menu).

Business rules implemented here, beyond plain CRUD:
- employee_code is server-generated (EMP-0001 style) and immutable, so the
  client never has to invent/guess identifiers.
- Email must be unique across employees (checked at the DB layer with a
  friendly 409 instead of a raw IntegrityError).
- Deletion is two-stage: DELETE /api/employees/{id} soft-deletes (status ->
  Inactive) by default; a `permanent=true` query flag does a hard delete,
  and only Admin/Manager roles may do that.
- Listing supports search text, department filter, status filter, salary
  range, pagination and sorting all in one endpoint, because that's what a
  real "Search Employee" screen needs.
- /autocomplete and /salary-range power the "More" menu's Autocomplete and
  Slider demos with real data instead of dummy widgets.
- /export.csv streams a CSV of the current filtered result set.
"""
import csv
import io
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.audit import write_audit
from app.auth import get_current_user, require_role
from app.database import get_db
from app.models import Employee, EmployeeStatus, RoleEnum, User
from app.schemas import EmployeeCreate, EmployeeNameHit, EmployeeOut, EmployeePage, EmployeeUpdate

router = APIRouter(prefix="/api/employees", tags=["employees"])


def _next_employee_code(db: Session) -> str:
    """EMP-0001, EMP-0002, ... derived from current row count + 1, retried on clash."""
    count = db.query(func.count(Employee.id)).scalar() or 0
    candidate = f"EMP-{count + 1:04d}"
    while db.query(Employee).filter(Employee.employee_code == candidate).first():
        count += 1
        candidate = f"EMP-{count + 1:04d}"
    return candidate


@router.post("", response_model=EmployeeOut, status_code=201)
def create_employee(
    payload: EmployeeCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = Employee(employee_code=_next_employee_code(db), **payload.model_dump())
    db.add(employee)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An employee with this email already exists")
    db.refresh(employee)
    write_audit(db, current_user.id, "CREATE", "Employee", employee.id, f"Created {employee.full_name}")
    return employee


@router.get("", response_model=EmployeePage)
def list_employees(
    q: Optional[str] = Query(None, description="Search by name, code, or email"),
    department: Optional[str] = None,
    status_filter: Optional[EmployeeStatus] = Query(None, alias="status"),
    min_salary: Optional[float] = Query(None, ge=0),
    max_salary: Optional[float] = Query(None, ge=0),
    sort_by: str = Query("full_name", pattern="^(full_name|salary|date_of_joining|department)$"),
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Employee)

    if q:
        like = f"%{q}%"
        query = query.filter(
            or_(Employee.full_name.ilike(like), Employee.employee_code.ilike(like), Employee.email.ilike(like))
        )
    if department:
        query = query.filter(Employee.department == department)
    if status_filter:
        query = query.filter(Employee.status == status_filter)
    if min_salary is not None:
        query = query.filter(Employee.salary >= min_salary)
    if max_salary is not None:
        query = query.filter(Employee.salary <= max_salary)

    total = query.count()

    sort_column = getattr(Employee, sort_by)
    sort_column = sort_column.desc() if sort_dir == "desc" else sort_column.asc()
    query = query.order_by(sort_column)

    items = query.offset((page - 1) * page_size).limit(page_size).all()
    return EmployeePage(total=total, page=page, page_size=page_size, items=items)


@router.get("/autocomplete", response_model=list[EmployeeNameHit])
def autocomplete(
    q: str = Query(..., min_length=1),
    limit: int = Query(8, ge=1, le=20),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Powers the 'More > Autocomplete' demo with live prefix search over real employees."""
    hits = (
        db.query(Employee)
        .filter(Employee.full_name.ilike(f"{q}%"))
        .order_by(Employee.full_name.asc())
        .limit(limit)
        .all()
    )
    return hits


@router.get("/salary-range")
def salary_range(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Powers the 'More > Slider' demo: returns min/max so the UI can size the slider."""
    lo = db.query(func.min(Employee.salary)).scalar() or 0
    hi = db.query(func.max(Employee.salary)).scalar() or 0
    return {"min": lo, "max": hi}


@router.get("/export.csv")
def export_csv(
    department: Optional[str] = None,
    status_filter: Optional[EmployeeStatus] = Query(None, alias="status"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Employee)
    if department:
        query = query.filter(Employee.department == department)
    if status_filter:
        query = query.filter(Employee.status == status_filter)

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["Employee Code", "Full Name", "Email", "Phone", "Gender", "Department",
         "Designation", "Salary", "Date of Joining", "Status"]
    )
    for e in query.order_by(Employee.employee_code.asc()).all():
        writer.writerow(
            [e.employee_code, e.full_name, e.email, e.phone, e.gender.value, e.department,
             e.designation, e.salary, e.date_of_joining.date().isoformat(), e.status.value]
        )
    buffer.seek(0)
    write_audit(db, current_user.id, "EXPORT", "Employee", None, "Exported employee list to CSV")
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=employees_{datetime.utcnow().date()}.csv"},
    )


@router.get("/{employee_id}", response_model=EmployeeOut)
def get_employee(
    employee_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    return employee


@router.put("/{employee_id}", response_model=EmployeeOut)
def update_employee(
    employee_id: int,
    payload: EmployeeUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    for field, value in payload.model_dump().items():
        setattr(employee, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="An employee with this email already exists")
    db.refresh(employee)
    write_audit(db, current_user.id, "UPDATE", "Employee", employee.id, f"Updated {employee.full_name}")
    return employee


@router.delete("/{employee_id}")
def delete_employee(
    employee_id: int,
    permanent: bool = Query(False, description="Hard-delete instead of deactivating"),
    current_user: User = Depends(require_role(RoleEnum.admin, RoleEnum.manager)),
    db: Session = Depends(get_db),
):
    employee = db.query(Employee).filter(Employee.id == employee_id).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if permanent:
        name = employee.full_name
        db.delete(employee)
        db.commit()
        write_audit(db, current_user.id, "DELETE", "Employee", employee_id, f"Permanently deleted {name}")
        return {"message": f"Employee {name} permanently deleted"}

    employee.status = EmployeeStatus.inactive
    db.commit()
    write_audit(db, current_user.id, "DELETE", "Employee", employee.id, f"Deactivated {employee.full_name}")
    return {"message": f"Employee {employee.full_name} deactivated"}