from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.api import api_router
from app.core.config import settings

app = FastAPI(title="Messenger API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: Restrict in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix=settings.API_V1_STR)

from app.api.v1.endpoints import websockets
app.include_router(websockets.router, prefix="/ws/chat", tags=["websockets"])

@app.get("/")
def read_root():
    return {"message": "Welcome to Messenger API"}

@app.get("/health")
def health_check():
    return {"status": "ok"}
