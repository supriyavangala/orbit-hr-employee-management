# Orbit HR — Employee Management System

A full-stack Python application built as a CRUD + "More Menu" reference
project, structured the way the **Magnus** training app (JALA Academy) is
laid out: a top navbar, a left sidebar with **Home / Employee / More /
Settings**, full CRUD on the core entity, and a "More" menu of UI-pattern
pages — but every page here is wired to real backend logic instead of being
a static demo.

## Tech stack

| Layer      | Choice                                  | Why                                                    |
| ---------- | --------------------------------------- | ------------------------------------------------------ |
| API        | **FastAPI**                             | async, typed, auto-generates OpenAPI docs at `/docs`   |
| ORM        | **SQLAlchemy 2.0**                      | swap SQLite → Postgres/MySQL by changing one URL       |
| DB (dev)   | **SQLite**                              | zero setup, file-based                                 |
| Validation | **Pydantic v2**                         | request/response schemas, custom field validators      |
| Auth       | **JWT (python-jose)** + **bcrypt**      | stateless sessions, hashed passwords                   |
| Frontend   | **Vanilla HTML/CSS/JS** (no build step) | "basic UI" as requested — focus stays on backend logic |

No Node/React build pipeline is needed — the frontend is plain static files
served directly by FastAPI, so `pip install` + `uvicorn` is the entire setup.

## Folder structure

```
JALA PROJECT/
├── requirements.txt
├── README.md
└── app/
    ├── main.py              # FastAPI app, mounts routers + static frontend
    ├── database.py          # SQLAlchemy engine/session
    ├── models.py            # ORM models: User, Employee, AuditLog, Announcement
    ├── schemas.py           # Pydantic request/response schemas + validators
    ├── auth.py              # JWT creation/validation, bcrypt hashing, role guard
    ├── audit.py             # write_audit() helper used by every mutating route
    ├── seed.py              # creates tables + demo data on first run
    ├── routers/
    │   ├── auth_router.py          # /api/auth        login, me, change-password, theme
    │   ├── employees_router.py     # /api/employees   full CRUD + search/autocomplete/export
    │   ├── users_router.py         # /api/users        admin-only account management
    │   ├── dashboard_router.py     # /api/dashboard    aggregate stats for Home
    │   ├── announcements_router.py # /api/announcements CRUD, feeds dashboard + Popups demo
    │   └── audit_router.py         # /api/audit-logs   read-only activity trail
    └── static/              # the "basic UI"
        ├── index.html
        ├── css/styles.css
        └── js/
            ├── api.js            # fetch wrapper + auth header injection
            ├── ui-helpers.js     # toast/modal/formatting helpers
            ├── shell.js          # sidebar, hash-router, login gate
            └── pages/            # one file per route (home, employee.*, more.*, settings.*)
```

## Setup

```bash
cd "JALA PROJECT"
python -m venv venv
venv\Scripts\activate              # macOS/Linux: source venv/bin/activate
pip install -r requirements.txt

uvicorn app.main:app --reload
```

Open **http://127.0.0.1:8000**. Tables are created and demo data is seeded
automatically on first startup (see `app/seed.py`).

### Demo logins

| Username | Password    | Role    |
| -------- | ----------- | ------- |
| admin    | Admin@123   | admin   |
| manager  | Manager@123 | manager |
| staff    | Staff@123   | staff   |

Interactive API docs (Swagger UI): **http://127.0.0.1:8000/docs**

## Feature map

### Employee (core CRUD entity)

- **Create** — form with client + server-side validation (email format,
  phone format, salary > 0, date of joining can't be in the future)
- **Search** — text search (name/code/email), department filter, status
  filter, sortable columns, pagination — all server-side
- **Edit** — modal form, reuses the create form's validation
- **Delete** — two-stage: default is a **soft delete** (status → Inactive);
  `?permanent=true` does a hard delete. Only Admin/Manager roles may delete.
- Server-generated, immutable `employee_code` (EMP-0001, EMP-0002, ...)
- **CSV export** of the current filtered list

### More menu (each tied to real data, not placeholder widgets)

| Menu item           | What it actually does                                         |
| ------------------- | ------------------------------------------------------------- |
| Multiple Tabs       | Department breakdown rendered as tabs, from live stats        |
| Menu                | Right-click context menu on real employee rows                |
| Autocomplete        | Live prefix search against `/api/employees/autocomplete`      |
| Collapsible Content | FAQ accordion explaining the app's own business rules         |
| Images              | Department tile gallery                                       |
| Slider              | Real salary-range filter — drag to re-query the database      |
| Tooltips            | Hover definitions of domain terms (Active/Inactive/Audit Log) |
| Popups              | Full CRUD modal for Announcements (create/list/delete)        |
| Links               | In-app hash-routed links + one external link                  |
| CSS Properties      | Live color/border-radius/opacity playground                   |
| iFrames             | An embedded `<iframe>` document                               |

### Settings

- **Change Password** — requires current password, enforces min length
- **Manage Users** — Admin-only: create accounts, change role, enable/disable,
  delete (can't disable/delete yourself)
- **Activity Log** — Admin/Manager-only audit trail (who did what, when)
- **Appearance** — light/dark theme, saved per-user

## Business logic & architecture highlights

- **Role-based access control**: three roles (`admin`, `manager`, `staff`)
  enforced via a `require_role(...)` FastAPI dependency factory, not
  scattered `if` statements
- **Audit trail**: every create/update/delete/login writes an `AuditLog` row
  via one shared helper (`app/audit.py`), so behavior is consistent everywhere
- **Soft vs. hard delete**: models a real-world HR requirement — you
  rarely want to truly lose an employee record
- **Two-layer validation**: Pydantic validators in `schemas.py` (server,
  authoritative) plus matching JS validation (client, for fast feedback) —
  server always wins if they disagree
- **Stateless JWT auth**: no server-side session store; horizontally
  scalable by design
- **Separation of concerns**: ORM models, Pydantic schemas, and JSON
  responses are three distinct layers on purpose, even though that's more
  files than a quick script would need
- **Single SQL aggregation for dashboard stats** rather than pulling every
  row into Python and counting in a loop

## Notes

- `EMS_SECRET_KEY` environment variable should be set to a strong random
  value in any real deployment; a development default is used otherwise.
- Switching from SQLite to PostgreSQL/MySQL only requires changing
  `DATABASE_URL` in `app/database.py` — no other file references SQL directly.
