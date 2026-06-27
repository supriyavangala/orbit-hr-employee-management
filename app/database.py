"""
Database engine & session configuration.

Uses SQLite for zero-setup local development. Because we go through
SQLAlchemy's ORM exclusively, swapping to PostgreSQL/MySQL in production
is just a matter of changing DATABASE_URL - no business logic touches
raw SQL or a vendor-specific dialect.
"""
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "sqlite:///./ems.db"

engine = create_engine(
    DATABASE_URL,
    # SQLite specific: allow usage across the threadpool FastAPI uses for sync routes
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """FastAPI dependency that yields a DB session and guarantees it's closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()