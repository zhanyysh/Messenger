# Wazzup — Messenger App

Short, realtime messenger for teams and small groups with group photos, file uploads and WebSocket-powered events.

## Short description

Wazzup is a minimal real-time messaging application. It includes user accounts, private and group chats, message history, unread counts, file/image uploads, and WebSocket events for realtime updates between clients.

## Features

- User registration and JWT authentication
- Private one-to-one chats
- Group chats with admins and roles
- Group photo (cover) upload and removal
- File and image uploads (Cloudinary in production)
- WebSocket real-time events for new messages and typing indicators
- Unread message counts per-chat
- REST API and Pydantic models for clear contracts

## Tech stack

- Backend: FastAPI, SQLAlchemy (async), Alembic, PostgreSQL
- Frontend: React + Vite + TypeScript
- Realtime: WebSockets (FastAPI / frontend WebSocket client)
- File storage (production): Cloudinary (local dev: mounted `uploads/` folder)
- Deployment: Google Cloud Run (frontend + backend)

## How to run locally

Recommended: Docker Compose (starts Postgres, runs migrations and starts backend + frontend):

```bash
# from repository root
docker compose up --build
```

Backend (manual):

```bash
cd backend
# create and activate venv, then
python -m pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Frontend (manual):

```bash
cd frontend
npm ci
npm run dev
```

Notes:
- Local backend serves uploaded files from `./backend/uploads/` (development only). In production the backend uploads files to Cloudinary — set `CLOUDINARY_URL` or `CLOUDINARY_*` env vars.
- Configure environment variables in `backend/.env` or Cloud Run settings: `DATABASE_URL`, `SECRET_KEY`, `CLOUDINARY_URL` (or `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `CLOUDINARY_CLOUD_NAME`).

## Live website

- Frontend: https://messenger-frontend-1087744761151.asia-south1.run.app
- Backend API: https://messenger-1087744761151.asia-south1.run.app

## YouTube demo

- (Add a demo link here) — e.g. https://www.youtube.com/watch?v=pBR-rKVpjbc


## API

Base API URL: https://messenger-1087744761151.asia-south1.run.app

Common endpoints:

- `POST /api/v1/login` — obtain JWT
- `GET /api/v1/chats/` — list user chats
- `POST /api/v1/upload/` — upload files (returns `url`)

---

If you want, I can add a one-click `gcloud run services update` snippet to set Cloud Run environment variables or add a short demo video and screenshots to the repo.
