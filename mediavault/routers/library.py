from fastapi import APIRouter, Request, Depends, HTTPException, Form
from fastapi.templating import Jinja2Templates
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from database import get_db
from models import MediaItem, ActivityLog, MediaCategory, MediaStatus
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
@router.get("/library/{item_id}")
async def detail_page(
    item_id: int,
    request: Request,
    db:      AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MediaItem).where(MediaItem.id == item_id))
    item   = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found.")

    logs_result = await db.execute(
        select(ActivityLog)
        .where(ActivityLog.media_item_id == item_id)
        .order_by(ActivityLog.timestamp.desc())
    )
    logs = logs_result.scalars().all()

    return templates.TemplateResponse("detail.html", {
        "request":    request,
        "item":       item,
        "logs":       logs,
        "statuses":   [s.value for s in MediaStatus],
    })


# ── PATCH /api/library/{id} — Update progress/status (called by JS) ───────────
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

    changes = []

    if payload.status and payload.status != item.status:
        changes.append(f"Status changed to {payload.status.value}")
        item.status = payload.status
        # Auto-log completion
        if payload.status == MediaStatus.COMPLETED:
            await log_activity(db, item, "Completed", f"Completed {item.title}.")

    if payload.progress is not None and payload.progress != item.progress:
        if item.total and payload.progress > item.total:
            raise HTTPException(
                status_code=400,
                detail=f"Progress cannot exceed total ({item.total})."
            )
        changes.append(f"Progress updated to {payload.progress}")
        item.progress = payload.progress
        await log_activity(
            db, item, "Updated progress",
            f"Updated progress of {item.title} to {payload.progress}."
        )

    if payload.user_rating is not None:
        item.user_rating = payload.user_rating
        changes.append(f"Rated {payload.user_rating}/10")
        await log_activity(db, item, "Rated", f"Rated {item.title} {payload.user_rating}/10.")

    await db.commit()
    return {"updated": changes}


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

    await db.execute(delete(ActivityLog).where(ActivityLog.media_item_id == item_id))
    await db.execute(delete(MediaItem).where(MediaItem.id == item_id))
    await db.commit()
    return {"deleted": item_id}