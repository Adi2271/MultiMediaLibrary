from sqlalchemy import (
    Column, Integer, String, Float, Text,
    DateTime, ForeignKey, Enum as SAEnum
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base
import enum


class MediaCategory(str, enum.Enum):
    ANIME     = "anime"
    MOVIE     = "movie"
    WEBSERIES = "webseries"
    BOOK      = "book"
    MANGA     = "manga"
    MANHWA    = "manhwa"
    WEBNOVEL  = "webnovel"


class MediaStatus(str, enum.Enum):
    WATCHING  = "watching"
    COMPLETED = "completed"
    PLANNING  = "planning"
    ON_HOLD   = "on_hold"
    DROPPED   = "dropped"


class MediaItem(Base):
    __tablename__ = "media_items"

    id              = Column(Integer, primary_key=True, index=True)
    title           = Column(String(500), nullable=False)
    category        = Column(SAEnum(MediaCategory), nullable=False, index=True)
    status          = Column(SAEnum(MediaStatus), nullable=False,
                             default=MediaStatus.PLANNING, index=True)

    external_id     = Column(String(100), nullable=True)
    source_api      = Column(String(50),  nullable=True)
    reference_url   = Column(String(1000), nullable=True)

    genres          = Column(Text, nullable=True)
    cover_image_url = Column(String(1000), nullable=True)
    synopsis        = Column(Text, nullable=True)
    year_released   = Column(Integer, nullable=True)

    progress        = Column(Integer, default=0)
    total           = Column(Integer, nullable=True)
    user_rating     = Column(Float, nullable=True)

    date_added      = Column(DateTime(timezone=True), server_default=func.now())
    date_updated    = Column(DateTime(timezone=True), onupdate=func.now())

    activity_logs   = relationship("ActivityLog", back_populates="media_item",
                                   cascade="all, delete-orphan")


class ActivityLog(Base):
    __tablename__ = "activity_logs"

    id              = Column(Integer, primary_key=True, index=True)
    media_item_id   = Column(Integer, ForeignKey("media_items.id"), nullable=False)
    action          = Column(String(100), nullable=False)
    detail          = Column(Text, nullable=True)
    progress_at_log = Column(Integer, nullable=True)
    timestamp       = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    media_item      = relationship("MediaItem", back_populates="activity_logs")