import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import MediaItem, MediaStatus
from collections import Counter
import os
from dotenv import load_dotenv

load_dotenv()

TMDB_BASE  = "https://api.themoviedb.org/3"
TMDB_IMAGE = "https://image.tmdb.org/t/p/w500"
API_KEY    = os.getenv("TMDB_API_KEY")

JIKAN_MANGA_GENRE_IDS = {
    "Action": 1, "Adventure": 2, "Comedy": 4, "Drama": 8,
    "Fantasy": 10, "Horror": 14, "Mystery": 7, "Romance": 22,
    "Sci-Fi": 24, "Slice of Life": 36, "Sports": 30,
    "Supernatural": 37, "Thriller": 41, "Psychological": 40,
    "Shounen": 27, "Seinen": 42, "Josei": 43, "Shoujo": 25,
}

# Jikan genre name → MAL genre ID
JIKAN_GENRE_IDS = {
    "Action": 1, "Adventure": 2, "Comedy": 4, "Drama": 8,
    "Fantasy": 10, "Horror": 14, "Mystery": 7, "Romance": 22,
    "Sci-Fi": 24, "Slice of Life": 36, "Sports": 30,
    "Supernatural": 37, "Thriller": 41, "Psychological": 40,
    "Shounen": 27, "Seinen": 42, "Mecha": 18, "Music": 19,
}

# TMDB genre name → TMDB genre ID
TMDB_MOVIE_GENRE_IDS = {
    "Action": 28, "Adventure": 12, "Animation": 16, "Comedy": 35,
    "Crime": 80, "Documentary": 99, "Drama": 18, "Family": 10751,
    "Fantasy": 14, "History": 36, "Horror": 27, "Music": 10402,
    "Mystery": 9648, "Romance": 10749, "Science Fiction": 878,
    "Thriller": 53, "War": 10752, "Western": 37,
}

TMDB_TV_GENRE_IDS = {
    "Action & Adventure": 10759, "Animation": 16, "Comedy": 35,
    "Crime": 80, "Documentary": 99, "Drama": 18, "Family": 10751,
    "Kids": 10762, "Mystery": 9648, "News": 10763, "Reality": 10764,
    "Sci-Fi & Fantasy": 10765, "Soap": 10766, "Talk": 10767,
    "War & Politics": 10768, "Western": 37,
}


async def get_recommendations(
    db:       AsyncSession,
    category: str,
    limit:    int = 15,
) -> list[dict]:

    # ── Step 1: Fetch library items for this category ─────────────────────
    result = await db.execute(
        select(MediaItem).where(
            MediaItem.category == category,
            MediaItem.genres   != None,
        )
    )
    all_items = result.scalars().all()

    if not all_items:
        return []

    # ── Step 2: Score genres by frequency + rating weight ─────────────────
    genre_scores: Counter = Counter()

    for item in all_items:
        if not item.genres:
            continue
        weight = 1.0
        if item.status == MediaStatus.COMPLETED:
            weight += 1.0
        if item.user_rating and item.user_rating >= 7.0:
            weight += item.user_rating / 10.0

        for genre in item.genres.split(","):
            genre = genre.strip()
            if genre:
                genre_scores[genre] += weight

    if not genre_scores:
        return []

    top_genres = [g for g, _ in genre_scores.most_common(3)]

    # ── Step 3: Fetch from correct endpoint ───────────────────────────────
    try:
        if category == "anime":
            api_results = await _recommend_anime(top_genres)
        elif category == "manga":
            api_results = await _recommend_manga(top_genres)
        elif category == "movie":
            api_results = await _recommend_tmdb(top_genres, "movie")
        elif category == "webseries":
            api_results = await _recommend_tmdb(top_genres, "webseries")
        else:
            return []
    except Exception:
        return []

    # ── Step 4: Filter out already saved titles ────────────────────────────
    existing_ids    = {item.external_id for item in all_items if item.external_id}
    existing_titles = {item.title.lower() for item in all_items}

    recommendations = []
    for r in api_results:
        already_saved = (
            r.get("external_id") in existing_ids or
            r.get("title", "").lower() in existing_titles
        )
        if not already_saved:
            recommendations.append(r)
        if len(recommendations) >= limit:
            break

    return recommendations


async def _recommend_anime(top_genres: list[str]) -> list[dict]:
    genre_ids = [
        str(JIKAN_GENRE_IDS[g])
        for g in top_genres
        if g in JIKAN_GENRE_IDS
    ]

    params = {
        "order_by": "popularity",
        "sort":     "asc",        # Most popular first
        "limit":    20,
        "sfw":      True,
        "min_score": 7.0,          # Only well-rated shows
    }
    if genre_ids:
        params["genres"] = ",".join(genre_ids[:2])

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get("https://api.jikan.moe/v4/anime", params=params)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for item in data.get("data", []):
        results.append({
            "external_id":     str(item["mal_id"]),
            "source_api":      "jikan",
            "title":           item.get("title_english") or item.get("title", ""),
            "cover_image_url": item.get("images", {}).get("jpg", {}).get("image_url"),
            "synopsis":        item.get("synopsis") or "",
            "year_released":   item.get("year"),
            "genres":          ",".join(g["name"] for g in item.get("genres", [])),
            "total":           item.get("episodes"),
            "reference_url":   item.get("url", ""),
            "score":           item.get("score"),
        })
    return results


async def _recommend_tmdb(top_genres: list[str], category: str) -> list[dict]:
    # Use discover endpoint — filters by genre ID, sorted by popularity
    genre_map = TMDB_MOVIE_GENRE_IDS if category == "movie" else TMDB_TV_GENRE_IDS
    endpoint  = "discover/movie" if category == "movie" else "discover/tv"

    genre_ids = [
        str(genre_map[g])
        for g in top_genres
        if g in genre_map
    ]

    # Fallback: try partial matches (e.g. "Sci-Fi" → "Science Fiction")
    if not genre_ids:
        for g in top_genres:
            for key in genre_map:
                if g.lower() in key.lower() or key.lower() in g.lower():
                    genre_ids.append(str(genre_map[key]))
                    break

    params = {
        "api_key":             API_KEY,
        "sort_by":             "popularity.desc",
        "vote_average.gte":    7.0,
        "vote_count.gte":      200,      # Avoid obscure low-vote titles
        "page":                1,
    }
    if genre_ids:
        params["with_genres"] = ",".join(genre_ids[:2])

    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(f"{TMDB_BASE}/{endpoint}", params=params)
        resp.raise_for_status()
        data = resp.json()

    # Reuse cached genre map from tmdb.py for label lookup
    from services.tmdb import _get_genre_map
    label_map = await _get_genre_map(category)

    results = []
    for item in data.get("results", [])[:15]:
        if category == "movie":
            title      = item.get("title", "")
            year       = int(item["release_date"][:4]) if item.get("release_date") else None
            reference  = f"https://www.themoviedb.org/movie/{item['id']}"
            total      = None
        else:
            title      = item.get("name", "")
            year       = int(item["first_air_date"][:4]) if item.get("first_air_date") else None
            reference  = f"https://www.themoviedb.org/tv/{item['id']}"
            total      = item.get("number_of_episodes")

        poster = item.get("poster_path")
        results.append({
            "external_id":     str(item["id"]),
            "source_api":      "tmdb",
            "title":           title,
            "cover_image_url": f"{TMDB_IMAGE}{poster}" if poster else None,
            "synopsis":        item.get("overview") or "",
            "year_released":   year,
            "genres":          ",".join(
                                   label_map.get(gid, "")
                                   for gid in item.get("genre_ids", [])
                               ),
            "total":           total,
            "reference_url":   reference,
            "score":           item.get("vote_average"),
        })
    return results

async def _recommend_manga(top_genres: list[str]) -> list[dict]:
    genre_ids = [
        str(JIKAN_MANGA_GENRE_IDS[g])
        for g in top_genres
        if g in JIKAN_MANGA_GENRE_IDS
    ]

    params = {
        "order_by":  "popularity",
        "sort":      "asc",
        "limit":     20,
        "sfw":       True,
        "min_score": 7.0,
        "type":      "manga",   # Only manga, excludes light novels/doujin
    }
    if genre_ids:
        params["genres"] = ",".join(genre_ids[:2])

    async with httpx.AsyncClient(timeout=12) as client:
        resp = await client.get("https://api.jikan.moe/v4/manga", params=params)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for item in data.get("data", []):
        results.append({
            "external_id":     str(item["mal_id"]),
            "source_api":      "jikan",
            "title":           item.get("title_english") or item.get("title", ""),
            "cover_image_url": item.get("images", {}).get("jpg", {}).get("image_url"),
            "synopsis":        item.get("synopsis") or "",
            "year_released":   item.get("published", {}).get("prop", {}).get("from", {}).get("year"),
            "genres":          ",".join(g["name"] for g in item.get("genres", [])),
            "total":           item.get("chapters"),
            "reference_url":   item.get("url", ""),
            "score":           item.get("score"),
        })
    return results