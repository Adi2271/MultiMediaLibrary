import httpx
import asyncio

JIKAN_BASE = "https://api.jikan.moe/v4"


async def search_anime(query: str, retries: int = 2) -> list[dict]:
    url    = f"{JIKAN_BASE}/anime"
    params = {"q": query, "limit": 12, "sfw": True}

    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                break
        except (httpx.TimeoutException, httpx.HTTPStatusError):
            if attempt < retries:
                await asyncio.sleep(1.2)  # Wait before retry
                continue
            return []
        except Exception:
            return []

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

async def search_manga(query: str, retries: int = 2) -> list[dict]:
    url    = f"{JIKAN_BASE}/manga"
    params = {"q": query, "limit": 12, "sfw": True}

    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(timeout=12) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                break
        except (httpx.TimeoutException, httpx.HTTPStatusError):
            if attempt < retries:
                await asyncio.sleep(1.2)
                continue
            return []
        except Exception:
            return []

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