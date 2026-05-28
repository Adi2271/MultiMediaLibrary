import httpx
import os
from dotenv import load_dotenv

load_dotenv()

TMDB_BASE  = "https://api.themoviedb.org/3"
TMDB_IMAGE = "https://image.tmdb.org/t/p/w500"
API_KEY    = os.getenv("TMDB_API_KEY")


async def search_movies(query: str) -> list[dict]:
    return await _tmdb_search(query, category="movie")


async def search_webseries(query: str) -> list[dict]:
    return await _tmdb_search(query, category="webseries")


async def _tmdb_search(query: str, category: str) -> list[dict]:
    endpoint  = "search/movie" if category == "movie" else "search/tv"
    url       = f"{TMDB_BASE}/{endpoint}"
    params    = {"api_key": API_KEY, "query": query, "page": 1}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

    # Fetch genre list to map genre_ids → genre names
    genre_map = await _get_genre_map(category)

    results = []
    for item in data.get("results", [])[:12]:
        if category == "movie":
            title        = item.get("title", "")
            release_year = int(item["release_date"][:4]) if item.get("release_date") else None
            reference    = f"https://www.themoviedb.org/movie/{item['id']}"
            total        = None
        else:
            title        = item.get("name", "")
            release_year = int(item["first_air_date"][:4]) if item.get("first_air_date") else None
            reference    = f"https://www.themoviedb.org/tv/{item['id']}"
            total        = item.get("number_of_episodes")

        poster = item.get("poster_path")

        results.append({
            "external_id":     str(item["id"]),
            "source_api":      "tmdb",
            "title":           title,
            "cover_image_url": f"{TMDB_IMAGE}{poster}" if poster else None,
            "synopsis":        item.get("overview", ""),
            "year_released":   release_year,
            "genres":          ",".join(
                                   genre_map.get(gid, "")
                                   for gid in item.get("genre_ids", [])
                               ),
            "total":           total,
            "reference_url":   reference,
            "score":           item.get("vote_average"),
        })
    return results


async def _get_genre_map(category: str) -> dict:
    endpoint = "genre/movie/list" if category == "movie" else "genre/tv/list"
    url      = f"{TMDB_BASE}/{endpoint}"
    params   = {"api_key": API_KEY}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

    return {g["id"]: g["name"] for g in data.get("genres", [])}