# Deploy To GCP (Cloud Run + Cloud SQL)

This guide deploys:
- Backend API to Cloud Run
- Frontend (Vite static build + nginx) to Cloud Run
- Postgres in Cloud SQL

## 1) Prerequisites

- gcloud CLI installed and authenticated
- Billing enabled for your GCP project
- Docker available locally or Cloud Build enabled

## 2) Set Variables

Run in shell and replace values:

```bash
PROJECT_ID="your-project-id"
REGION="asia-southeast1"
REPO="glsmsg"
DB_INSTANCE="glsmsg-db"
DB_NAME="messenger"
DB_USER="appuser"
DB_PASSWORD="change-this-password"
SECRET_KEY="change-this-secret-key"
```

## 3) Enable APIs

```bash
gcloud services enable run.googleapis.com \
  artifactregistry.googleapis.com \
  cloudbuild.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com
```

## 4) Create Artifact Registry

```bash
gcloud artifacts repositories create "$REPO" \
  --repository-format=docker \
  --location="$REGION" \
  --description="GLSMSG images"
```

## 5) Create Cloud SQL (Postgres)

```bash
gcloud sql instances create "$DB_INSTANCE" \
  --database-version=POSTGRES_16 \
  --cpu=1 \
  --memory=3840MB \
  --region="$REGION"

gcloud sql databases create "$DB_NAME" --instance="$DB_INSTANCE"

gcloud sql users create "$DB_USER" \
  --instance="$DB_INSTANCE" \
  --password="$DB_PASSWORD"
```

Get instance connection name:

```bash
INSTANCE_CONNECTION_NAME=$(gcloud sql instances describe "$DB_INSTANCE" --format='value(connectionName)')
echo "$INSTANCE_CONNECTION_NAME"
```

## 6) Build And Push Backend Image

```bash
gcloud builds submit backend \
  --tag "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/backend:latest"
```

## 7) Deploy Backend To Cloud Run

Database URL for Cloud SQL Unix socket:

```bash
DATABASE_URL="postgresql+asyncpg://$DB_USER:$DB_PASSWORD@/$DB_NAME?host=/cloudsql/$INSTANCE_CONNECTION_NAME"
```

Deploy backend:

```bash
gcloud run deploy glsmsg-backend \
  --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/backend:latest" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated \
  --add-cloudsql-instances "$INSTANCE_CONNECTION_NAME" \
  --set-env-vars "DATABASE_URL=$DATABASE_URL,SECRET_KEY=$SECRET_KEY,ALGORITHM=HS256,ACCESS_TOKEN_EXPIRE_MINUTES=30,BACKEND_CORS_ORIGINS=*"
```

Get backend URL:

```bash
BACKEND_URL=$(gcloud run services describe glsmsg-backend --region="$REGION" --format='value(status.url)')
echo "$BACKEND_URL"
```

## 8) Run Alembic Migrations On Cloud Run

Create job:

```bash
gcloud run jobs create glsmsg-migrate \
  --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/backend:latest" \
  --region "$REGION" \
  --add-cloudsql-instances "$INSTANCE_CONNECTION_NAME" \
  --set-env-vars "DATABASE_URL=$DATABASE_URL,SECRET_KEY=$SECRET_KEY,ALGORITHM=HS256,ACCESS_TOKEN_EXPIRE_MINUTES=30" \
  --command alembic \
  --args upgrade,head
```

Execute job:

```bash
gcloud run jobs execute glsmsg-migrate --region "$REGION" --wait
```

If job already exists, use update + execute:

```bash
gcloud run jobs update glsmsg-migrate \
  --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/backend:latest" \
  --region "$REGION" \
  --add-cloudsql-instances "$INSTANCE_CONNECTION_NAME" \
  --set-env-vars "DATABASE_URL=$DATABASE_URL,SECRET_KEY=$SECRET_KEY,ALGORITHM=HS256,ACCESS_TOKEN_EXPIRE_MINUTES=30" \
  --command alembic \
  --args upgrade,head

gcloud run jobs execute glsmsg-migrate --region "$REGION" --wait
```

## 9) Build And Push Frontend Image

```bash
gcloud builds submit frontend \
  --config frontend/cloudbuild.yaml \
  --substitutions _IMAGE="$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/frontend:latest",_VITE_API_BASE_URL="$BACKEND_URL",_VITE_WS_BASE_URL="${BACKEND_URL/https:/wss:}"
```

Alternative local build:

```bash
docker build \
  --build-arg VITE_API_BASE_URL="$BACKEND_URL" \
  --build-arg VITE_WS_BASE_URL="${BACKEND_URL/https:/wss:}" \
  -t "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/frontend:latest" frontend

docker push "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/frontend:latest"
```

## 10) Deploy Frontend To Cloud Run

```bash
gcloud run deploy glsmsg-frontend \
  --image "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/frontend:latest" \
  --platform managed \
  --region "$REGION" \
  --allow-unauthenticated
```

Get frontend URL:

```bash
gcloud run services describe glsmsg-frontend --region="$REGION" --format='value(status.url)'
```

## 11) Tighten CORS (Recommended)

After frontend deploy, set exact frontend origin on backend:

```bash
FRONTEND_URL=$(gcloud run services describe glsmsg-frontend --region="$REGION" --format='value(status.url)')

gcloud run services update glsmsg-backend \
  --region "$REGION" \
  --set-env-vars "BACKEND_CORS_ORIGINS=$FRONTEND_URL"
```

## 12) Verify

- Open frontend URL and register/login
- Check backend health endpoint: `GET /health`
- Check Cloud Run logs for both services
- Check migration job logs for alembic output
