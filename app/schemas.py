"""
Pydantic schemas.

Kept separate from the ORM models on purpose: request payloads, DB rows, and
response bodies have different shapes (e.g. passwords never round-trip back
out), and this separation is what lets FastAPI auto-generate accurate
OpenAPI docs and validation errors at /docs.
"""
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field, field_validator

from app.models import EmployeeStatus, GenderEnum, RoleEnum

# ---------------------------------------------------------------- Auth/User


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    email: EmailStr
    password: str = Field(min_length=6, max_length=72)
    role: RoleEnum = RoleEnum.staff


class UserOut(BaseModel):
    id: int
    username: str
    email: EmailStr
    role: RoleEnum
    is_active: bool
    theme: str
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class PasswordChange(BaseModel):
    current_password: str
    new_password: str = Field(min_length=6, max_length=72)


class ThemeUpdate(BaseModel):
    theme: str = Field(pattern="^(light|dark)$")


# ------------------------------------------------------------------ Employee


class EmployeeBase(BaseModel):
    full_name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    phone: str = Field(min_length=7, max_length=20)
    gender: GenderEnum
    department: str = Field(min_length=2, max_length=60)
    designation: str = Field(min_length=2, max_length=60)
    salary: float = Field(gt=0, le=10_000_000)
    date_of_joining: datetime
    address: Optional[str] = None
    status: EmployeeStatus = EmployeeStatus.active

    @field_validator("date_of_joining")
    @classmethod
    def doj_not_in_future(cls, v: datetime) -> datetime:
        if v.date() > datetime.utcnow().date():
            raise ValueError("Date of joining cannot be in the future")
        return v

    @field_validator("phone")
    @classmethod
    def phone_digits(cls, v: str) -> str:
        cleaned = v.replace(" ", "").replace("-", "").replace("+", "")
        if not cleaned.isdigit():
            raise ValueError("Phone must contain only digits, spaces, '-' or '+'")
        return v


class EmployeeCreate(EmployeeBase):
    pass


class EmployeeUpdate(EmployeeBase):
    pass


class EmployeeOut(EmployeeBase):
    id: int
    employee_code: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EmployeePage(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[EmployeeOut]


class EmployeeNameHit(BaseModel):
    id: int
    full_name: str
    employee_code: str
    department: str


# -------------------------------------------------------------------- Audit


class AuditLogOut(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: Optional[int]
    details: Optional[str]
    timestamp: datetime
    actor_username: Optional[str] = None

    class Config:
        from_attributes = True


# -------------------------------------------------------------- Announcement


class AnnouncementCreate(BaseModel):
    title: str = Field(min_length=2, max_length=150)
    body: str = Field(min_length=2)


class AnnouncementOut(AnnouncementCreate):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


# ------------------------------------------------------------------ Dashboard


class DepartmentCount(BaseModel):
    department: str
    count: int


class DashboardStats(BaseModel):
    total_employees: int
    active_employees: int
    inactive_employees: int
    total_monthly_salary: float
    by_department: list[DepartmentCount]
    recent_hires: list[EmployeeOut]