from fastapi import APIRouter, Request, Query
from fastapi.templating import Jinja2Templates
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from database import get_db
from services.jikan import search_anime, search_manga
from services.tmdb import search_movies, search_webseries
from services.recommender import get_recommendations

router    = APIRouter()
templates = Jinja2Templates(directory="templates")


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
        # User searched — show results, skip recommendations
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
            error = f"Search failed — API may be rate limited. Please try again in a moment."
    else:
        # No search query — show recommendations instead
        try:
            recommendations = await get_recommendations(db, category)
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


# ── JSON endpoint for JS fetch ─────────────────────────────────────────────
@router.get("/api/search")
async def search_api(
    q:        str = Query(...),
    category: str = Query(default="anime"),
):
    try:
        if category == "anime":
            results = await search_anime(q)
        elif category == "movie":
            results = await search_movies(q)
        elif category == "webseries":
            results = await search_webseries(q)
        else:
            results = []
        return {"results": results, "query": q, "category": category}
    except Exception as e:
        return {"error": str(e), "results": []}
    
@router.get("/api/tmdb-trending/{media_type}")
async def tmdb_trending(media_type: str):
    import os
    from dotenv import load_dotenv
    load_dotenv()
    api_key = os.getenv("TMDB_API_KEY")
    url     = f"https://api.themoviedb.org/3/trending/{media_type}/week"
    params  = {"api_key": api_key}

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for item in data.get("results", [])[:10]:
        poster = item.get("poster_path")
        results.append({
            "title": item.get("title") or item.get("name", ""),
            "score": item.get("vote_average"),
            "image": f"https://image.tmdb.org/t/p/w92{poster}" if poster else None,
            "year":  (item.get("release_date") or item.get("first_air_date") or "")[:4],
        })
    return {"results": results}