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
    
    # Group logs by date
    from collections import defaultdict
    from models import RemovalLog
    
    # Fetch all logs joined with media item info, newest first
    result = await db.execute(
        select(ActivityLog, MediaItem)
        .join(MediaItem, ActivityLog.media_item_id == MediaItem.id)
        .order_by(ActivityLog.timestamp.desc())
        .limit(100)
    )
    rows = result.all()
    
    # Fetch removal logs
    removal_result = await db.execute(
        select(RemovalLog).order_by(RemovalLog.timestamp.desc()).limit(50)
    )
    removals = removal_result.scalars().all()
    
    grouped = defaultdict(list)
    
    for log, item in rows:
        date_obj = log.timestamp.date()
        grouped[date_obj].append({
            "action":    log.action,
            "detail":    log.detail,
            "time":      log.timestamp.strftime("%I:%M %p"),
            "timestamp": log.timestamp,
            "item_id":   item.id,
            "title":     item.title,
            "category":  item.category.value,
            "cover":     item.cover_image_url,
            "status":    item.status.value,
        })

    for removal in removals:
        date_obj = removal.timestamp.date()
        grouped[date_obj].append({
            "action":   "Removed",
            "detail":   removal.detail,
            "time":     removal.timestamp.strftime("%I:%M %p"),
            "timestamp": removal.timestamp,
            "item_id":  None,
            "title":    removal.title,
            "category": removal.category,
            "cover":    None,
            "status":   "dropped",
        })

    sorted_grouped = {
        date_obj.strftime("%B %d, %Y"): sorted(
            logs,
            key=lambda entry: entry["timestamp"],
            reverse=True,
        )
        for date_obj, logs in sorted(grouped.items(), key=lambda x: x[0], reverse=True)
    }

    return templates.TemplateResponse("timeline.html", {
        "request": request,
        "grouped": sorted_grouped,
    })