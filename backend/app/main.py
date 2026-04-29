import os

from app.api.v1.api import api_router
from app.api.v1.endpoints import websockets
from app.core.config import settings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Wazzup API")

cors_origins = ["*"]
if settings.BACKEND_CORS_ORIGINS.strip() != "*":
    cors_origins = [
        origin.strip()
        for origin in settings.BACKEND_CORS_ORIGINS.split(",")
        if origin.strip()
    ]

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

# Mount media static files
if not os.path.exists("uploads"):
    os.makedirs("uploads")
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(websockets.router, prefix="/ws/chat", tags=["websockets"])


@app.get("/")
def read_root():
    return {"message": "Welcome to Messenger API"}


@app.get("/health")
def health_check():
    return {"status": "ok"}
