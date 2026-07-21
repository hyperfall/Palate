"""Scrape recipe URLs into the owned Postgres store.

  python scrape.py <url> [<url>...]     scrape and upsert (idempotent by URL)
  python scrape.py --file urls.txt      one URL per line, # comments allowed
  python scrape.py --images             attach Unsplash photos to bare rows

recipe-scrapers handles the per-site parsing (hundreds of sites); we fetch
the page ourselves with a desktop UA, paced politely, and keep the full raw
payload so future schema changes never need a re-scrape.
"""

import re
import sys
import time
from urllib.parse import urlparse

from curl_cffi import requests as browser
from recipe_scrapers import scrape_html

import db
import derive
import images

PACE_SECONDS = 3  # be a polite guest on other people's sites


def to_minutes(value) -> int | None:
    """Scrapers usually return int minutes, but some sites yield '30 minutes'
    or '1 hour 20 minutes' — coerce anything time-shaped to int minutes."""
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value).lower()
    hours = sum(int(h) for h in re.findall(r"(\d+)\s*h", text))
    mins = sum(int(m) for m in re.findall(r"(\d+)\s*m", text))
    if hours or mins:
        return hours * 60 + mins
    digits = re.search(r"\d+", text)
    return int(digits.group()) if digits else None


def to_number(value, cast):
    if value is None:
        return None
    try:
        return cast(value)
    except (TypeError, ValueError):
        digits = re.search(r"\d+(?:\.\d+)?", str(value))
        return cast(float(digits.group())) if digits else None


def safe(getter, default=None):
    try:
        value = getter()
        return value if value not in ("", [], {}) else default
    except Exception:
        return default


def scrape_one(url: str) -> dict | None:
    # curl_cffi impersonates a real Chrome TLS fingerprint — this is what gets
    # past the bot walls (AllRecipes, Serious Eats) that 403 plain clients.
    resp = browser.get(url, impersonate="chrome", timeout=30, allow_redirects=True)
    if resp.status_code != 200:
        print(f"  ✗ {url} — HTTP {resp.status_code}")
        return None

    # supported_only=False: schema.org fallback, so ANY recipe site with
    # structured data works. best_image=True: highest-resolution image.
    scraper = scrape_html(resp.text, org_url=url, supported_only=False, best_image=True)

    title = safe(scraper.title)
    ingredients = safe(scraper.ingredients, [])
    # instructions_list() is the library's own step segmentation — better than
    # splitting the joined text ourselves.
    instructions = safe(scraper.instructions_list) or [
        line.strip() for line in (safe(scraper.instructions, "") or "").split("\n") if line.strip()
    ]
    if not title or not ingredients or not instructions:
        print(f"  ✗ {url} — scraper returned incomplete data")
        return None

    nutrients = safe(scraper.nutrients)
    yields = safe(scraper.yields)
    category = safe(scraper.category)
    keywords = safe(scraper.keywords)

    return {
        "source_url": url,
        "host": urlparse(url).netloc.removeprefix("www."),
        "title": title,
        "author": safe(scraper.author),
        "description": safe(scraper.description),
        "ingredients": ingredients,
        "ingredient_groups": safe(
            lambda: [
                {"purpose": g.purpose, "ingredients": g.ingredients}
                for g in scraper.ingredient_groups()
            ]
        ),
        "instructions": instructions,
        "yields": yields,
        "servings": derive.parse_servings(yields),
        "canonical_url": safe(scraper.canonical_url),
        "site_name": safe(scraper.site_name),
        "language": safe(scraper.language),
        "total_minutes": to_minutes(safe(scraper.total_time)),
        "cook_minutes": to_minutes(safe(scraper.cook_time)),
        "prep_minutes": to_minutes(safe(scraper.prep_time)),
        "cuisine": safe(scraper.cuisine),
        "category": category,
        "nutrients": nutrients,
        **derive.parse_nutrients(nutrients),
        **derive.derive_facets(category, keywords, ingredients, instructions),
        "cuisine_slug": derive.derive_cuisine_slug(
            safe(scraper.cuisine), title, keywords, category, ingredients
        ),
        "ratings": to_number(safe(scraper.ratings), float),
        "ratings_count": to_number(safe(scraper.ratings_count), int),
        "equipment": safe(scraper.equipment),
        "cooking_method": safe(scraper.cooking_method),
        "dietary_restrictions": safe(scraper.dietary_restrictions),
        "keywords": keywords,
        "scraped_image": safe(scraper.image),
        "raw": safe(scraper.to_json, {}),
    }


def _need(args: list[str], index: int, usage: str) -> str:
    """Fetch a required positional arg or bail with __doc__ instead of an
    IndexError traceback."""
    if index >= len(args):
        print(f"Missing argument: {usage}\n")
        print(__doc__)
        sys.exit(1)
    return args[index]


def _count_arg(text: str, usage: str) -> int:
    try:
        return int(text)
    except ValueError:
        print(f"Expected a number for {usage}, got {text!r}\n")
        print(__doc__)
        sys.exit(1)


def _read_lines(path: str) -> list[str]:
    try:
        with open(path) as f:
            return [l.strip() for l in f if l.strip() and not l.startswith("#")]
    except OSError as error:
        print(f"Couldn't read {path}: {error}")
        sys.exit(1)


def main() -> None:
    args = sys.argv[1:]
    if not args:
        print(__doc__)
        sys.exit(1)

    conn = db.connect()
    try:
        if args[0] == "--images":
            attached, missed = images.attach_missing_images(conn)
            print(f"\nImages: {attached} attached, {missed} without a match.")
            return

        if args[0] == "--discover":
            if _need(args, 1, "--discover host N | --discover --file F N") == "--file":
                path = _need(args, 2, "--discover --file <path> [N]")
                hosts = [h for h in _read_lines(path) if "/" not in h.split("://")[-1].rstrip("/")]
                want = _count_arg(args[3], "N") if len(args) > 3 else 5
            else:
                hosts = [args[1]]
                want = _count_arg(args[2], "N") if len(args) > 2 else 10
            total = 0
            for host in hosts:
                print(f"Discovering recipes on {host}…")
                saved = tried = 0
                for url in discover(host, want):
                    if saved >= want or tried >= want * 6:
                        break
                    if db.exists(conn, url):
                        continue  # already ours — no fetch, no duplicate
                    tried += 1
                    time.sleep(PACE_SECONDS)
                    try:
                        row = scrape_one(url)
                    except Exception:
                        row = None
                    if row:
                        try:
                            db.upsert_recipe(conn, row)
                            saved += 1
                            print(f"  ✓ {row['title']}")
                        except Exception as error:
                            db.rollback(conn)
                            print(f"  ✗ {row['title']} — save failed: {error}")
                total += saved
            print(f"\nDone — {total} new recipes saved.")
            return

        if args[0] == "--file":
            urls = _read_lines(_need(args, 1, "--file <path>"))
        else:
            urls = args

        created = updated = failed = 0
        for i, url in enumerate(urls):
            if i > 0:
                time.sleep(PACE_SECONDS)
            try:
                row = scrape_one(url)
            except Exception as error:  # one bad site never kills the batch
                print(f"  ✗ {url} — {error}")
                row = None
            if row is None:
                failed += 1
                continue
            try:
                _, was_created = db.upsert_recipe(conn, row)
            except Exception as error:
                db.rollback(conn)
                failed += 1
                print(f"  ✗ {row['title']} — save failed: {error}")
                continue
            created += was_created
            updated += not was_created
            print(f"  ✓ {row['title']} ({row['host']})")

        print(f"\nDone — {created} new, {updated} updated, {failed} failed.")
        print("Next: python scrape.py --images  (Unsplash), then the LLM rewrite pass (llm.py).")
    finally:
        conn.close()


def discover(host: str, want: int) -> list[str]:
    """Find recipe URLs on a site via its sitemaps (robots.txt → sitemap.xml).
    Paced like every other fetch here — sitemap indexes can fan out into
    dozens of requests, and this is still someone else's server."""
    base = f"https://{host.removeprefix('https://').removeprefix('http://').strip('/')}"
    seeds: list[str] = []
    try:
        robots = browser.get(f"{base}/robots.txt", impersonate="chrome", timeout=20).text
        seeds = re.findall(r"(?im)^sitemap:\s*(\S+)", robots)
    except Exception:
        pass
    seeds = seeds or [f"{base}/sitemap.xml", f"{base}/sitemap_index.xml"]

    pages: list[str] = []
    queue = list(seeds)
    seen = set()
    while queue and len(pages) < want * 8 and len(seen) < 25:
        sitemap_url = queue.pop(0)
        if sitemap_url in seen:
            continue
        if seen:  # no sleep before the very first request
            time.sleep(PACE_SECONDS)
        seen.add(sitemap_url)
        try:
            xml = browser.get(sitemap_url, impersonate="chrome", timeout=30).text
        except Exception:
            continue
        locs = re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", xml)
        for loc in locs:
            if loc.endswith(".xml") or "sitemap" in loc.rsplit("/", 1)[-1]:
                # prefer post/recipe sitemaps when expanding indexes
                queue.insert(0, loc) if re.search(r"recipe|post", loc, re.I) else queue.append(loc)
            elif not re.search(r"\.(jpg|png|webp|pdf)$|/(category|tag|author|about|page)/", loc, re.I):
                pages.append(loc)

    # recipe-ish URLs first, then everything else as fallback candidates
    pages.sort(key=lambda u: 0 if re.search(r"recipe", u, re.I) else 1)
    return pages


if __name__ == "__main__":
    main()
