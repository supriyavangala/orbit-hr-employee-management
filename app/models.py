"""
ORM models.

Entities:
- User        : application login accounts (Admin / Manager / Staff roles)
- Employee    : the core CRUD entity (mirrors the reference app's "Employee" module)
- AuditLog    : immutable trail of who-did-what-when, written by a SQLAlchemy event
                listener rather than scattered manually through route handlers
- Announcement: simple content entity surfaced on the dashboard / "More > Popups"
"""
import enum
from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class RoleEnum(str, enum.Enum):
    admin = "admin"
    manager = "manager"
    staff = "staff"


class GenderEnum(str, enum.Enum):
    male = "Male"
    female = "Female"
    other = "Other"


class EmployeeStatus(str, enum.Enum):
    active = "Active"
    inactive = "Inactive"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(120), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(Enum(RoleEnum), default=RoleEnum.staff, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    theme = Column(String(10), default="light", nullable=False)  # light | dark
    created_at = Column(DateTime, default=datetime.utcnow)

    audit_entries = relationship("AuditLog", back_populates="actor")


class Employee(Base):
    __tablename__ = "employees"

    id = Column(Integer, primary_key=True, index=True)
    employee_code = Column(String(20), unique=True, index=True, nullable=False)
    full_name = Column(String(120), nullable=False, index=True)
    email = Column(String(120), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=False)
    gender = Column(Enum(GenderEnum), nullable=False)
    department = Column(String(60), nullable=False, index=True)
    designation = Column(String(60), nullable=False)
    salary = Column(Float, nullable=False)
    date_of_joining = Column(DateTime, nullable=False)
    address = Column(Text, nullable=True)
    status = Column(Enum(EmployeeStatus), default=EmployeeStatus.active, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    action = Column(String(20), nullable=False)       # CREATE | UPDATE | DELETE | LOGIN
    entity_type = Column(String(40), nullable=False)  # e.g. "Employee"
    entity_id = Column(Integer, nullable=True)
    details = Column(Text, nullable=True)              # human readable summary
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)

    actor = relationship("User", back_populates="audit_entries")


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False)
    body = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)