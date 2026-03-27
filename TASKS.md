# Project Tasks (MVP)

- [x] **0. CI/CD Pipeline (GitHub Actions)**
    - [x] Initialize Backend Project (pyproject.toml/requirements.txt)
    - [x] Create `.github/workflows/ci.yml`
    - [x] Configure Frontend CI (ESLint, Vitest, Build)
    - [x] Configure Backend CI (Ruff, Pytest, Black)

- [x] **1. Project Skeleton & Infrastructure**
    - [x] Initialize Frontend (Vite + React + TS + Tailwind)
    - [x] Initialize Backend (FastAPI + Poetry/Requirements)
    - [x] Configure `.env` for Local PostgreSQL Connection
    - [x] Set up basic folder structure

- [x] **2. Database & Auth (Backend)**
    - [x] Define `User` model (SQLAlchemy/Tortoise)
    - [x] Implement Registration endpoint (POST /auth/register)
    - [x] Implement Login endpoint (POST /auth/login) -> JWT
    - [x] Implement `get_current_user` dependency

- [x] **3. Auth (Frontend)**
    - [x] Create Login Page
    - [x] Create Registration Page
    - [x] Implement Auth Context (store token)
    - [x] Protected Route wrapper

- [x] **4. Messaging Core (Backend)**
    - [x] Define `Chat` and `Message` models
    - [x] Implement WebSocket endpoint (`/ws/chat/{chat_id}`)
    - [x] Implement `POST /api/chats` (create chat)
    - [x] Implement `GET /api/chats/{chat_id}/messages` (history)

- [x] **5. Messaging UI (Frontend)**
    - [x] Create Chat Layout (Sidebar + Message Area)
    - [x] Implement WebSocket connection logic
    - [x] Display incoming messages in real-time
    - [x] Send message input

- [x] **6. Groups & Search**
    - [x] Backend: `GET /api/users/search` (search by email/name)
    - [x] Backend: `POST /api/groups/{id}/members` (add member)
    - [x] Frontend: User Search Component
    - [x] Frontend: Create Group Modal

- [x] **7. Rich Media**
    - [x] Backend: `POST /api/upload` (save to local disk)d
    - [x] Backend: Serve static files
    - [x] Frontend: File Input & Image Preview
    - [x] Frontend: Audio Recorder for Voice Notes
