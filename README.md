# GLSMSG Workspace

## Frontend Deployment Config

Frontend API and WebSocket base URLs are environment-driven via Vite variables:

- VITE_API_BASE_URL
- VITE_WS_BASE_URL (optional)

The helper that resolves these values lives in [frontend/src/lib/api.ts](frontend/src/lib/api.ts).

## Environment Matrix

| Environment | File to start from | API base example | WS base example |
| --- | --- | --- | --- |
| Development | frontend/.env.development.example | http://127.0.0.1:8000 | ws://127.0.0.1:8000 |
| Staging | frontend/.env.staging.example | https://api-staging.example.com | wss://api-staging.example.com |
| Production | frontend/.env.production.example | https://api.example.com | wss://api.example.com |

## Recommended Flow

1. Copy one example file into frontend/.env for local testing, or into frontend/.env.<mode> for CI/build mode.
2. Replace example domains with your actual backend URL.
3. Leave VITE_WS_BASE_URL unset unless websocket traffic uses a different host.
4. Build with the intended mode (for example, vite build --mode staging).

## Docker Compose (Backend + Postgres)

Use [docker-compose.yml](docker-compose.yml) to run API and database together.

1. Ensure [backend/.env](backend/.env) contains at least SECRET_KEY and other app settings.
2. Start services:

```bash
docker compose up --build
```

3. API will be available at `http://localhost:8000`.

Notes:

- In compose, `DATABASE_URL` is overridden to the internal Postgres service URL.
- Postgres data is persisted in the `postgres_data` Docker volume.
