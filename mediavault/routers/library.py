from fastapi import APIRouter, Request, Depends, HTTPException, Form
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from database import get_db
from models import MediaItem, ActivityLog, MediaCategory, MediaStatus, RemovalLog
from schemas import MediaItemCreate, MediaItemUpdate
from typing import Optional
import json

router    = APIRouter()
templates = Jinja2Templates(directory="templates")


# ── Helper: create an activity log entry ──────────────────────────────────────
async def log_activity(db: AsyncSession, item: MediaItem, action: str, detail: str):
    log = ActivityLog(
        media_item_id   = item.id,
        action          = action,
        detail          = detail,
        progress_at_log = item.progress,
    )
    db.add(log)
    await db.commit()


# ── POST /api/library — Add item (called by JS fetch) ─────────────────────────
@router.post("/api/library")
async def add_to_library(
    payload: MediaItemCreate,
    db:      AsyncSession = Depends(get_db),
):
    # Check for duplicate by external_id or title
    if payload.external_id:
        existing = await db.execute(
            select(MediaItem).where(MediaItem.external_id == payload.external_id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=400, detail="Already in library.")

    item = MediaItem(**payload.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)

    await log_activity(db, item, "Added", f"Added {item.title} to library.")
    return {"id": item.id, "title": item.title}


# ── GET /library — Full library page (Jinja2) ─────────────────────────────────
@router.get("/library")
async def library_page(
    request:  Request,
    status:   Optional[str] = None,
    category: Optional[str] = None,
    db:       AsyncSession  = Depends(get_db),
):
    query = select(MediaItem).order_by(MediaItem.date_added.desc())

    if status:
        query = query.where(MediaItem.status == status)
    if category:
        query = query.where(MediaItem.category == category)

    result = await db.execute(query)
    items  = result.scalars().all()

    return templates.TemplateResponse("library.html", {
        "request":         request,
        "items":           items,
        "selected_status": status,
        "selected_cat":    category,
        "statuses":        [s.value for s in MediaStatus],
        "categories":      [c.value for c in MediaCategory],
    })


# ── GET /library/{id} — Detail page (Jinja2) ──────────────────────────────────
@router.patch("/api/library/{item_id}")
async def update_item(
    item_id: int,
    payload: MediaItemUpdate,
    db:      AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MediaItem).where(MediaItem.id == item_id))
    item   = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")

    if payload.status and payload.status != item.status:
        old_status = item.status.value
        item.status = payload.status
        await log_activity(
            db, item,
            payload.status.value.replace("_", " ").title(),
            f"{payload.status.value.replace('_',' ').title()} {item.title}."
        )

    if payload.progress is not None and payload.progress != item.progress:
        if item.total and payload.progress > item.total:
            raise HTTPException(
                status_code=400,
                detail=f"Progress cannot exceed total ({item.total})."
            )
        item.progress = payload.progress
        await log_activity(
            db, item, "Updated progress",
            f"Updated progress of {item.title} to {payload.progress}."
        )

    if payload.user_rating is not None and payload.user_rating != item.user_rating:
        item.user_rating = payload.user_rating
        await log_activity(
            db, item, "Rated",
            f"Rated {item.title} {payload.user_rating}/10."
        )

    await db.commit()
    return {"updated": True}


# ── DELETE /api/library/{id} — Remove item ────────────────────────────────────
@router.delete("/api/library/{item_id}")
async def delete_item(
    item_id: int,
    db:      AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MediaItem).where(MediaItem.id == item_id))
    item   = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")

    from models import RemovalLog
    removal = RemovalLog(
        title    = item.title,
        category = item.category.value,
        action   = "Removed",
        detail   = f"Removed {item.title} from library.",
    )
    db.add(removal)
    await db.execute(delete(ActivityLog).where(ActivityLog.media_item_id == item_id))
    await db.execute(delete(MediaItem).where(MediaItem.id == item_id))
    await db.commit()
    return {"deleted": item_id}
    
    # Log removal BEFORE deleting (cascade will kill logs after)
    # So we create a standalone log with no FK — store title in detail
    # Instead: just delete quietly but keep a ghost log approach
    # Simplest: log it first, then delete logs, then delete item