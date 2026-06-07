from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Messenger MVP"
    API_V1_STR: str = "/api/v1"
    DATABASE_URL: str
    SECRET_KEY: str
    MESSAGE_ENCRYPTION_KEY: str
    BACKEND_CORS_ORIGINS: str = "*"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Cloudinary settings
    CLOUDINARY_CLOUD_NAME: Optional[str] = None
    CLOUDINARY_API_KEY: Optional[str] = None
    CLOUDINARY_API_SECRET: Optional[str] = None
    CLOUDINARY_UPLOAD_FOLDER: Optional[str] = None
    # Full Cloudinary URL (e.g. cloudinary://key:secret@cloudname)
    CLOUDINARY_URL: Optional[str] = None

    # Gemini settings
    GEMINI_API_KEY: Optional[str] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
