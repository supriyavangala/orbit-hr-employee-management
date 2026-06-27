"""
App entrypoint.

Wires up:
- All API routers under /api/*
- A health check
- The static frontend (plain HTML/CSS/JS) served at /
- Auto table creation + seed data on startup, so a fresh clone works
  immediately with `uvicorn app.main:app`.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.routers import (
    announcements_router,
    audit_router,
    auth_router,
    dashboard_router,
    employees_router,
    users_router,
)
from app.seed import run as seed_run


@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_run()
    yield


app = FastAPI(title="Orbit HR — Employee Management System", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router)
app.include_router(employees_router.router)
app.include_router(users_router.router)
app.include_router(dashboard_router.router)
app.include_router(announcements_router.router)
app.include_router(audit_router.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.mount("/", StaticFiles(directory="app/static", html=True), name="static")