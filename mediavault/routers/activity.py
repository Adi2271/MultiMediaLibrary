from fastapi import APIRouter, Request, Depends
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import ActivityLog, MediaItem

router    = APIRouter()
templates = Jinja2Templates(directory="templates")


@router.get("/timeline")
async def timeline_page(
    request: Request,
    db:      AsyncSession = Depends(get_db),
):
    # Fetch all logs joined with media item info, newest first
    result = await db.execute(
        select(ActivityLog, MediaItem)
        .join(MediaItem, ActivityLog.media_item_id == MediaItem.id)
        .order_by(ActivityLog.timestamp.desc())
        .limit(100)
    )
    rows = result.all()

    # Group logs by date
    from collections import defaultdict
    grouped = defaultdict(list)
    for log, item in rows:
        date_key = log.timestamp.strftime("%B %d, %Y")
        grouped[date_key].append({
            "action":    log.action,
            "detail":    log.detail,
            "time":      log.timestamp.strftime("%I:%M %p"),
            "item_id":   item.id,
            "title":     item.title,
            "category":  item.category.value,
            "cover":     item.cover_image_url,
            "status":    item.status.value,
        })

    return templates.TemplateResponse("timeline.html", {
        "request": request,
        "grouped": dict(grouped),
    })