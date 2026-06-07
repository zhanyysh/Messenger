# Wazzup — Messenger App

Wazzup is a real-time messaging application designed for teams and small groups. It supports user authentication, private and group chats, media uploads, and real-time updates via WebSockets.

## Tech Stack

- **Backend:** FastAPI (Python), SQLAlchemy (Async), Alembic (Migrations), PostgreSQL.
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS, Zustand (State Management).
- **Real-time:** WebSockets (FastAPI / native client).
- **File Storage:** Local storage for development (`/backend/uploads`), Cloudinary for production.

## Directory Structure

- `backend/`: FastAPI application code, database models, and migrations.
  - `app/`: Main application logic.
    - `api/v1/`: REST API endpoints and WebSocket handlers.
    - `core/`: Configuration and security settings.
    - `crud/`: CRUD operations (Create, Read, Update, Delete).
    - `db/`: Database session management and base classes.
    - `models/`: SQLAlchemy database models.
    - `schemas/`: Pydantic models for API contracts.
    - `services/`: External services (e.g., Gemini integration).
  - `alembic/`: Database migration scripts.
  - `tests/`: Backend test suite using `pytest`.
- `frontend/`: React application code.
  - `src/`: Source code.
    - `components/`: Reusable UI components.
    - `pages/`: Page-level components.
    - `store/`: Zustand state stores.
    - `lib/`: API clients and utility functions.
  - `tests/`: Frontend test suite using `vitest`.
- `docker-compose.yml`: Local development environment setup.

## Development Workflow

### Running Locally

**Using Docker (Recommended):**
```bash
docker compose up --build
```
This starts PostgreSQL, the backend, and the frontend.

**Manual Setup:**
- **Backend:**
  ```bash
  cd backend
  python -m pip install -r requirements.txt
  uvicorn app.main:app --reload
  ```
- **Frontend:**
  ```bash
  cd frontend
  npm install
  npm run dev
  ```

### Testing

- **Backend:** `cd backend && pytest`
- **Frontend:** `cd frontend && npm test`

### Linting and Formatting

- **Backend:** `ruff check backend/`, `black backend/`, `isort backend/`
- **Frontend:** `npm run lint`

## Development Conventions

### Backend Patterns
- **Async First:** Use `async/await` for database and network operations.
- **Pydantic Schemas:** Always use Pydantic models for request validation and response serialization.
- **Dependency Injection:** Use FastAPI's `Depends` for database sessions and authentication.
- **Migrations:** Use Alembic for any database schema changes.

### Frontend Patterns
- **Functional Components:** Use React functional components with hooks.
- **TypeScript:** Strict typing for props, state, and API responses.
- **Zustand:** Centralized state management for auth and chat data.
- **Tailwind CSS:** Utility-first styling with Tailwind CSS v4.

### Real-time Communication
- WebSockets are used for new messages, typing indicators, and unread count updates.
- WebSocket endpoint: `/ws/chat?token={jwt}`.

## Agent Instructions

- **Surgical Edits:** When modifying code, ensure changes are idiomatically complete and consistent with existing patterns (e.g., async SQLAlchemy).
- **Test-Driven:** Always check for existing tests and add new ones for bug fixes or features.
- **Database Changes:** If a model is changed, generate a new Alembic migration: `alembic revision --autogenerate -m "description"`.
- **API Consistency:** Ensure REST API changes are reflected in Pydantic schemas and frontend API clients (`frontend/src/lib/api.ts`).

## Productivity Workflow

To maximize productivity in this workspace, use the following multi-agent strategy:

1. **Main Agent (Gemini CLI):** Use for project orchestration, running builds/tests, and standard refactoring.
2. **@nemotron-agent:** Use for complex architectural changes or debugging tricky logic. Its "reasoning" capability is best for "how should I solve this?" questions.
3. **@kimi-agent:** Use when you need to analyze large chunks of code or multiple files simultaneously (e.g., "Analyze all files in `app/crud/` and find inconsistencies").
4. **@glm-agent:** Use for rapid code generation and bilingual documentation/comments.

**Example Workflow:**
- Ask **@nemotron-agent** to design a new feature.
- Use the **Main Agent** to implement the boilerplate and migrations.
- Ask **@kimi-agent** to review the implementation against existing patterns.
- Use **Main Agent** to run tests and finalize.

