import httpx

JIKAN_BASE = "https://api.jikan.moe/v4"


async def search_anime(query: str) -> list[dict]:
    url = f"{JIKAN_BASE}/anime"
    params = {"q": query, "limit": 12, "sfw": True}

    async with httpx.AsyncClient() as client:
        response = await client.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

    results = []
    for item in data.get("data", []):
        results.append({
            "external_id":     str(item["mal_id"]),
            "source_api":      "jikan",
            "title":           item.get("title_english") or item.get("title", ""),
            "cover_image_url": item.get("images", {}).get("jpg", {}).get("image_url"),
            "synopsis":        item.get("synopsis", ""),
            "year_released":   item.get("year"),
            "genres":          ",".join(g["name"] for g in item.get("genres", [])),
            "total":           item.get("episodes"),
            "reference_url":   item.get("url", ""),
            "score":           item.get("score"),
        })
    return results