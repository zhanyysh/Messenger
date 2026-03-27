from pydantic import BaseModel


class MediaResponse(BaseModel):
    url: str
    filename: str
    content_type: str
