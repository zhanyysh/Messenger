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

- [ ] **2. Database & Auth (Backend)**
    - [ ] Define `User` model (SQLAlchemy/Tortoise)
    - [ ] Implement Registration endpoint (POST /auth/register)
    - [ ] Implement Login endpoint (POST /auth/login) -> JWT
    - [ ] Implement `get_current_user` dependency

- [ ] **3. Auth (Frontend)**
    - [ ] Create Login Page
    - [ ] Create Registration Page
    - [ ] Implement Auth Context (store token)
    - [ ] Protected Route wrapper

- [ ] **4. Messaging Core (Backend)**
    - [ ] Define `Chat` and `Message` models
    - [ ] Implement WebSocket endpoint (`/ws/chat/{chat_id}`)
    - [ ] Implement `POST /api/chats` (create chat)
    - [ ] Implement `GET /api/chats/{chat_id}/messages` (history)

- [ ] **5. Messaging UI (Frontend)**
    - [ ] Create Chat Layout (Sidebar + Message Area)
    - [ ] Implement WebSocket connection logic
    - [ ] Display incoming messages in real-time
    - [ ] Send message input

- [ ] **6. Groups & Search**
    - [ ] Backend: `POST /api/groups` (create group)
    - [ ] Backend: `POST /api/groups/{id}/members` (add member)
    - [ ] Frontend: User Search Component
    - [ ] Frontend: Create Group Modal

- [ ] **7. Rich Media**
    - [ ] Backend: `POST /api/upload` (save to local disk)
    - [ ] Backend: Serve static files
    - [ ] Frontend: File Input & Image Preview
    - [ ] Frontend: Audio Recorder for Voice Notes
