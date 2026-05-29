from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models import MediaItem, MediaStatus
from services.jikan import search_anime
from services.tmdb import search_movies, search_webseries
from collections import Counter


async def get_recommendations(
    db:       AsyncSession,
    category: str,
    limit:    int = 6,
) -> list[dict]:
    """
    Pulls top genres from user's completed/high-rated library items
    in the given category, then queries the relevant API for matches.
    """

    # ── Step 1: Fetch relevant library items ──────────────────────────────
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

        # Weight: completed = 2x, high rating = bonus, others = 1x
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

    # ── Step 3: Pick top 3 genres as search query ─────────────────────────
    top_genres = [g for g, _ in genre_scores.most_common(3)]
    query      = " ".join(top_genres)

    # ── Step 4: Fetch from API ─────────────────────────────────────────────
    try:
        if category == "anime":
            api_results = await search_anime(query)
        elif category == "movie":
            api_results = await search_movies(query)
        elif category == "webseries":
            api_results = await search_webseries(query)
        else:
            return []
    except Exception:
        return []

    # ── Step 5: Filter out titles already in library ───────────────────────
    existing_ids     = {item.external_id for item in all_items if item.external_id}
    existing_titles  = {item.title.lower() for item in all_items}

    recommendations = []
    for r in api_results:
        already_saved = (
            r.get("external_id") in existing_ids or
            r.get("title", "").lower() in existing_titles
        )
        if not already_saved:
            r["is_recommendation"] = True
            recommendations.append(r)

        if len(recommendations) >= limit:
            break

    return recommendations