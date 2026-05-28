from fastapi import APIRouter, Request, Query
from fastapi.templating import Jinja2Templates
from services.jikan import search_anime
from services.tmdb import search_movies, search_webseries

router    = APIRouter()
templates = Jinja2Templates(directory="templates")


@router.get("/search")
async def search_page(
    request:  Request,
    q:        str = Query(default=""),
    category: str = Query(default="anime"),
):
    results = []
    error   = None

    if q:
        try:
            if category == "anime":
                results = await search_anime(q)
            elif category == "movie":
                results = await search_movies(q)
            elif category == "webseries":
                results = await search_webseries(q)
        except Exception as e:
            error = f"Search failed: {str(e)}"

    return templates.TemplateResponse("index.html", {
        "request":  request,
        "results":  results,
        "query":    q,
        "category": category,
        "error":    error,
    })


# JSON endpoint — called by app.js fetch()
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