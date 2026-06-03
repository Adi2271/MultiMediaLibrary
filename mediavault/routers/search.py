from fastapi import APIRouter, Request, Query, Depends
from fastapi.templating import Jinja2Templates
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import MediaItem
from services.jikan import search_anime, search_manga
from services.tmdb import search_movies, search_webseries
from services.recommender import get_recommendations
import httpx, os
from dotenv import load_dotenv

load_dotenv()

router    = APIRouter()
templates = Jinja2Templates(directory="templates")

TMDB_BASE = "https://api.themoviedb.org/3"
TMDB_IMG  = "https://image.tmdb.org/t/p/w92"
API_KEY   = os.getenv("TMDB_API_KEY")


@router.get("/search")
async def search_page(
    request:  Request,
    q:        str = Query(default=""),
    category: str = Query(default="anime"),
    db:       AsyncSession = Depends(get_db),
):
    results         = []
    recommendations = []
    error           = None

    if q:
        try:
            if category == "anime":
                results = await search_anime(q)
            elif category == "manga":
                results = await search_manga(q)
            elif category == "movie":
                results = await search_movies(q)
            elif category == "webseries":
                results = await search_webseries(q)
        except Exception as e:
            error = "Search failed — API may be rate limited. Please try again."
    else:
        try:
            recommendations = await get_recommendations(db, category, limit=21)
        except Exception:
            recommendations = []

    return templates.TemplateResponse("index.html", {
        "request":         request,
        "results":         results,
        "recommendations": recommendations,
        "query":           q,
        "category":        category,
        "error":           error,
    })


@router.get("/api/search")
async def search_api(
    q:        str = Query(...),
    category: str = Query(default="anime"),
):
    try:
        if category == "anime":
            results = await search_anime(q)
        elif category == "manga":
            results = await search_manga(q)
        elif category == "movie":
            results = await search_movies(q)
        elif category == "webseries":
            results = await search_webseries(q)
        else:
            results = []
        return {"results": results, "query": q, "category": category}
    except Exception as e:
        return {"error": str(e), "results": []}


# ── TMDB Trending proxy (fixes CORS) ──────────────────────────────────────
@router.get("/api/tmdb-trending/{media_type}")
async def tmdb_trending(media_type: str, window: str = "week"):
    if media_type not in ("movie", "tv"):
        return {"results": []}
    if window not in ("day", "week"):
        window = "week"

    url    = f"{TMDB_BASE}/trending/{media_type}/{window}"
    params = {"api_key": API_KEY}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return {"results": []}

    results = []
    for item in data.get("results", [])[:10]:
        poster = item.get("poster_path")
        results.append({
            "title": item.get("title") or item.get("name", ""),
            "score": round(item.get("vote_average", 0), 1),
            "image": f"{TMDB_IMG}{poster}" if poster else None,
            "year":  (item.get("release_date") or item.get("first_air_date") or "")[:4],
        })
    return {"results": results}


# ── Jikan top proxy ────────────────────────────────────────────────────────
@router.get("/api/jikan-top/{media_type}")
async def jikan_top(media_type: str, filter: str = "bypopularity"):
    if media_type not in ("anime", "manga"):
        return {"results": []}
    valid_filters = {
        "anime": ["airing", "upcoming", "bypopularity", "favorite"],
        "manga": ["publishing", "bypopularity", "favorite"],
    }
    if filter not in valid_filters.get(media_type, []):
        filter = "bypopularity"

    url    = f"https://api.jikan.moe/v4/top/{media_type}"
    params = {"limit": 10, "filter": filter}

    try:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.get(url, params=params)
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        return {"results": []}

    results = []
    for item in data.get("data", []):
        results.append({
            "title": item.get("title_english") or item.get("title", ""),
            "score": item.get("score"),
            "image": item.get("images", {}).get("jpg", {}).get("image_url"),
            "year":  item.get("year") or (
                item.get("published", {}).get("prop", {}).get("from", {}).get("year")
            ),
        })
    return {"results": results}


# ── Refresh total episodes for ongoing series ──────────────────────────────
@router.post("/api/library/{item_id}/refresh")
async def refresh_total(
    item_id: int,
    db:      AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MediaItem).where(MediaItem.id == item_id))
    item   = result.scalar_one_or_none()
    if not item:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Not found.")

    new_total = None

    try:
        if item.source_api == "jikan" and item.external_id:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"https://api.jikan.moe/v4/anime/{item.external_id}"
                )
                data = resp.json().get("data", {})
                new_total = data.get("episodes")

        elif item.source_api == "tmdb" and item.external_id:
            endpoint = "tv" if item.category.value == "webseries" else "movie"
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.get(
                    f"{TMDB_BASE}/{endpoint}/{item.external_id}",
                    params={"api_key": API_KEY}
                )
                data = resp.json()
                new_total = data.get("number_of_episodes")
    except Exception:
        pass

    if new_total and new_total != item.total:
        item.total = new_total
        await db.commit()
        return {"updated": True, "new_total": new_total}

    return {"updated": False, "new_total": item.total}