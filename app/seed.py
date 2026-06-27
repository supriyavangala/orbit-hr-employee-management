"""
Creates all tables and seeds a small amount of demo data so the app is
immediately explorable after first run, instead of opening to an empty shell.

Run directly: python -m app.seed
"""
from datetime import datetime, timedelta

from app.auth import hash_password
from app.database import Base, SessionLocal, engine
from app.models import Announcement, Employee, EmployeeStatus, GenderEnum, RoleEnum, User

DEMO_EMPLOYEES = [
    ("Asha Kapoor", "asha.kapoor@example.com", "9876500001", GenderEnum.female, "Engineering", "Backend Developer", 78000, 420),
    ("Rohan Mehta", "rohan.mehta@example.com", "9876500002", GenderEnum.male, "Engineering", "Frontend Developer", 72000, 250),
    ("Priya Nair", "priya.nair@example.com", "9876500003", GenderEnum.female, "Engineering", "QA Engineer", 65000, 600),
    ("Vikram Singh", "vikram.singh@example.com", "9876500004", GenderEnum.male, "Sales", "Sales Executive", 55000, 900),
    ("Neha Joshi", "neha.joshi@example.com", "9876500005", GenderEnum.female, "Sales", "Sales Manager", 95000, 1200),
    ("Karan Verma", "karan.verma@example.com", "9876500006", GenderEnum.male, "HR", "HR Generalist", 60000, 800),
    ("Sneha Reddy", "sneha.reddy@example.com", "9876500007", GenderEnum.female, "HR", "HR Manager", 105000, 1500),
    ("Arjun Rao", "arjun.rao@example.com", "9876500008", GenderEnum.male, "Finance", "Accountant", 58000, 700),
    ("Divya Pillai", "divya.pillai@example.com", "9876500009", GenderEnum.female, "Finance", "Finance Analyst", 70000, 365),
    ("Sahil Khan", "sahil.khan@example.com", "9876500010", GenderEnum.male, "Engineering", "DevOps Engineer", 88000, 30),
]


def run():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        if db.query(User).count() == 0:
            db.add_all(
                [
                    User(username="admin", email="admin@orbithr.com",
                         hashed_password=hash_password("Admin@123"), role=RoleEnum.admin),
                    User(username="manager", email="manager@orbithr.com",
                         hashed_password=hash_password("Manager@123"), role=RoleEnum.manager),
                    User(username="staff", email="staff@orbithr.com",
                         hashed_password=hash_password("Staff@123"), role=RoleEnum.staff),
                ]
            )
            db.commit()
            print("Seeded users: admin/Admin@123, manager/Manager@123, staff/Staff@123")

        if db.query(Employee).count() == 0:
            today = datetime.utcnow()
            for i, (name, email, phone, gender, dept, role, salary, days_ago) in enumerate(DEMO_EMPLOYEES, start=1):
                db.add(
                    Employee(
                        employee_code=f"EMP-{i:04d}",
                        full_name=name,
                        email=email,
                        phone=phone,
                        gender=gender,
                        department=dept,
                        designation=role,
                        salary=salary,
                        date_of_joining=today - timedelta(days=days_ago),
                        address="221B, MG Road",
                        status=EmployeeStatus.active,
                    )
                )
            db.commit()
            print(f"Seeded {len(DEMO_EMPLOYEES)} employees")

        if db.query(Announcement).count() == 0:
            db.add_all(
                [
                    Announcement(title="Welcome to Orbit HR",
                                 body="This is a demo Employee Management System built with FastAPI."),
                    Announcement(title="Payroll cycle reminder",
                                 body="Monthly payroll runs on the last working day of every month."),
                ]
            )
            db.commit()
            print("Seeded announcements")
    finally:
        db.close()


if __name__ == "__main__":
    run()