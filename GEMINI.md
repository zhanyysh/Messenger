# GLSMSG Workspace Context

## Project Overview

GLSMSG is a Telegram-like Messenger MVP built as a responsive web application. It provides robust 1:1 and group chatting, real-time messaging using WebSockets, and rich media/voice notes sharing capabilities. 

### Technology Stack

*   **Frontend:** React 19 (TypeScript), Vite, TailwindCSS (v4), Zustand (State Management), Framer Motion, React Router DOM.
*   **Backend:** Python 3, FastAPI, SQLAlchemy (Async), Alembic, Uvicorn, PostgreSQL.
*   **Database:** PostgreSQL (managed via Docker).
*   **Infrastructure:** Docker Compose for local orchestration.

## Directory Structure

*   `/frontend`: Contains the Vite/React application.
*   `/backend`: Contains the FastAPI application, database migrations (`/alembic`), and API endpoints (`/app`).
*   `/`: Root directory contains configuration files like `docker-compose.yml`, `README.md`, and `PRD.md`.

## Building and Running

### Full Stack via Docker (Recommended)

To run the entire stack (Frontend, Backend, and Postgres) using Docker Compose:

```bash
docker compose up --build
```
*   Frontend: `http://localhost:3000`
*   Backend API: `http://localhost:8000`

### Local Development - Backend

1.  Navigate to the backend directory: `cd backend`
2.  Set up your virtual environment and install dependencies: `pip install -r requirements.txt`
3.  Configure environment variables in `backend/.env` (minimum `SECRET_KEY` and `DATABASE_URL`).
4.  Run database migrations: `alembic upgrade head`
5.  Start the development server: `uvicorn app.main:app --reload`
6.  Run Tests: `pytest`

### Local Development - Frontend

1.  Navigate to the frontend directory: `cd frontend`
2.  Install dependencies: `npm install`
3.  Configure environment variables in `frontend/.env` (e.g., `VITE_API_BASE_URL`).
4.  Start the development server: `npm run dev`
5.  Run Tests: `npm run test` or `npm run test:run`
6.  Build: `npm run build`

## Development Conventions

*   **Backend:** 
    *   Fully `async`/`await` architecture.
    *   REST APIs for standard operations, WebSockets for real-time events.
    *   Code formatting and linting: `ruff`, `black`, `isort`, and `mypy` (configured via `pyproject.toml`).
    *   Testing: `pytest` with `pytest-asyncio` and `httpx`.
*   **Frontend:** 
    *   Strict TypeScript implementation.
    *   Functional components with Hooks. State managed via `zustand`.
    *   Styling: TailwindCSS + HeadlessUI/RadixUI style integrations.
    *   Testing: `vitest` and React Testing Library.
    *   Linting: `eslint`.
*   **General:** Adhere to the MVP scope outlined in `PRD.md` (e.g., no E2EE for MVP, focus on responsive web apps over native mobile).

## Key Files

*   `PRD.md`: The Product Requirements Document outlining the core user stories and implementation decisions.
*   `README.md`: General setup and deployment instructions.
*   `docker-compose.yml`: Defines the local development services (db, migrate, backend).
