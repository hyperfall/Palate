"""Unsplash photo attachment — quality photography for owned recipes.

Uses the official search API. Unsplash's guidelines require photographer
attribution and hotlinking the returned `urls` (they serve from their CDN),
plus triggering the download endpoint when a photo is used — all handled here.
No key set → a clear no-op, never a crash.
"""

import os
import re
import time

import httpx
from dotenv import load_dotenv

import db

load_dotenv()

ACCESS_KEY = os.environ.get("UNSPLASH_ACCESS_KEY", "")
API = "https://api.unsplash.com"

# Demo apps get 50 requests/hour (1,000/hour after production approval).
# We read the live X-Ratelimit-Remaining header and stop BEFORE hitting zero —
# repeatedly slamming the limit is what gets API access revoked.
STOP_AT_REMAINING = 3
PACE_SECONDS = 1.5
_exhausted = False


_NOISE = re.compile(
    r"\b(recipe|recipes|easy|best|quick|simple|perfect|homemade|healthy|ultimate|"
    r"classic|authentic|creamy|crispy|high.altitude|vegan|vegetarian|gluten.?free|"
    r"whole30|paleo|keto|low.?carb|instant pot|air fryer|slow cooker)\b|\(.*?\)",
    re.I,
)


def clean_title(title: str) -> str:
    """Strip blog noise so the query is the dish, not the SEO wrapper."""
    return re.sub(r"\s+", " ", _NOISE.sub(" ", title)).strip(" -–—:")


def _relevance(photo: dict, tokens: set[str]) -> int:
    """Score a candidate by dish-token overlap in its alt/description/tags,
    with a bonus for clearly-foody framing. 0 = do not use."""
    text = " ".join(
        filter(
            None,
            [
                photo.get("alt_description") or "",
                photo.get("description") or "",
                " ".join(t.get("title", "") for t in photo.get("tags", [])),
            ],
        )
    ).lower()
    score = sum(2 for t in tokens if t in text)
    if re.search(r"\b(food|dish|meal|plate|bowl|cuisine|cooked|baked)\b", text):
        score += 1
    return score


def find_photo(query: str, extra_tokens: set[str] | None = None) -> dict | None:
    """Best food photo for a dish name. Returns {url, credit} or None.

    Pulls several candidates in ONE request and picks the highest dish-token
    relevance — "black sesame okra" must match okra-the-dish, not a macro shot
    of black seeds that reads as pebbles. Nothing relevant → None; a missing
    photo beats a wrong one."""
    global _exhausted
    if not ACCESS_KEY or _exhausted:
        return None
    time.sleep(PACE_SECONDS)
    try:
        resp = httpx.get(
            f"{API}/search/photos",
            params={
                "query": f"{query} food dish",
                "orientation": "landscape",
                "content_filter": "high",
                "per_page": 1,
            },
            headers={"Authorization": f"Client-ID {ACCESS_KEY}"},
            timeout=20,
        )
    except httpx.HTTPError as error:
        # A network blip must not kill the batch — this row is just unmatched,
        # retryable on the next run since unsplash_image stays NULL.
        print(f"  ✗ Unsplash request failed: {error}")
        return None

    try:
        remaining = int(resp.headers.get("X-Ratelimit-Remaining", "999"))
    except ValueError:
        remaining = 999
    if resp.status_code == 401:
        # Bad/revoked key — retrying every subsequent row would just fail the
        # same way, so stop like we would on quota exhaustion.
        print("  ⏸ Unsplash rejected the access key (401) — stopping for this run.")
        _exhausted = True
    elif resp.status_code == 403 or remaining <= STOP_AT_REMAINING:
        print(f"  ⏸ Unsplash hourly quota nearly spent ({remaining} left) — stopping; re-run next hour.")
        _exhausted = True
    if resp.status_code != 200:
        return None
    try:
        results = resp.json().get("results", [])
    except ValueError:
        return None
    if not results:
        return None
    photo = results[0]

    # Unsplash guideline: report the download when the photo is actually used.
    download = (photo.get("links") or {}).get("download_location")
    if download:
        try:
            httpx.get(download, headers={"Authorization": f"Client-ID {ACCESS_KEY}"}, timeout=10)
        except httpx.HTTPError:
            pass

    name = (photo.get("user") or {}).get("name", "Unknown")
    return {
        # regular = 1080px wide from their CDN — matches our 1600px hero need
        # closely and can be resized via width params later.
        "url": photo["urls"]["regular"],
        "credit": f"Photo by {name} on Unsplash",
    }


def attach_missing_images(conn) -> tuple[int, int]:
    """Fill unsplash_image for rows that lack one. Returns (attached, missed)."""
    with conn.cursor() as cur:
        cur.execute(
            """SELECT id, title, main_ingredient, course FROM recipes
               WHERE qc_status = 'pass' AND unsplash_image IS NULL ORDER BY id"""
        )
        rows = cur.fetchall()

    attached = missed = 0
    for recipe_id, title, main_ingredient, course in rows:
        try:
            dish = clean_title(title)
            photo = find_photo(dish, {main_ingredient or "", course or ""} - {""})
            if photo is None and main_ingredient and not _exhausted:
                # Second, broader attempt: the ingredient as a dish.
                photo = find_photo(f"{main_ingredient} {course or 'dish'}")
        except Exception as error:  # one bad row must never kill the batch
            missed += 1
            print(f"  ✗ {title} — Unsplash lookup failed: {error}")
            continue
        if photo is None:
            missed += 1
            print(f"  ✗ {title} — no Unsplash match")
            continue
        try:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE recipes SET unsplash_image = %s, unsplash_credit = %s WHERE id = %s",
                    (photo["url"], photo["credit"], recipe_id),
                )
            conn.commit()
        except Exception as error:
            db.rollback(conn)
            missed += 1
            print(f"  ✗ {title} — save failed: {error}")
            continue
        attached += 1
        print(f"  ✓ {title} — {photo['credit']}")
    return attached, missed
