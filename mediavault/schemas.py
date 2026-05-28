from pydantic import BaseModel
from typing import Optional
from models import MediaCategory, MediaStatus


class MediaItemCreate(BaseModel):
    title:           str
    category:        MediaCategory
    external_id:     Optional[str]  = None
    source_api:      Optional[str]  = None
    reference_url:   Optional[str]  = None
    genres:          Optional[str]  = None
    cover_image_url: Optional[str]  = None
    synopsis:        Optional[str]  = None
    year_released:   Optional[int]  = None
    total:           Optional[int]  = None


class MediaItemUpdate(BaseModel):
    status:      Optional[MediaStatus] = None
    progress:    Optional[int]         = None
    user_rating: Optional[float]       = None