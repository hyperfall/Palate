# Palate Backend — owned recipe pipeline

The path off third-party APIs: scrape recipes we choose with
[recipe-scrapers](https://github.com/hhursev/recipe-scrapers) (fetched via
curl_cffi browser impersonation, so bot-walled sites like AllRecipes work),
store them in our own Postgres, QC them like a factory line, attach quality
photography from Unsplash, and rewrite instructions into Palate's voice with
an LLM. Local Postgres now, cloud later — the schema is plain SQL.

## Setup

```bash
cd palate-backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
psql -U postgres -c 'CREATE DATABASE palate_backend'
psql -U postgres -d palate_backend -f schema.sql
cp .env.example .env   # add UNSPLASH_ACCESS_KEY + OPENAI_API_KEY
```

## The factory line (run in this order)

```bash
# 1. INTAKE — scrape recipes into the store (idempotent by URL; a repeat
#    run only updates). Rows land as qc_status='pending'.
python scrape.py <recipe-url> [<recipe-url>…]
python scrape.py --file urls.txt                 # individual recipe URLs
python scrape.py --discover budgetbytes.com 25   # find recipes via sitemaps
python scrape.py --discover --file urls.txt 5    # sweep every site in the file

# 2. QC — nothing ships unchecked. Machine gate rejects junk for free
#    (crafts, roundups, thin methods, non-food; non-English → review);
#    everything else gets an LLM verdict (edible? single recipe? complete?
#    quality 1-5). Only 'pass' rows continue down the line.
python qc.py                 # judges pending rows
python qc.py --recheck       # re-judges the whole catalog

# 3. PHOTOS — Unsplash, matched by cleaned dish name against candidate
#    tags/descriptions with a relevance floor (a missing photo beats a
#    wrong one), falling back to "<main ingredient> <course>".
python scrape.py --images

# 4. VOICE — the Generative Chef: Creator rewrites the method in Palate's
#    register; a numeric guardrail then an Inspector verify nothing about
#    the cooking changed. PASS → instructions_rewritten; FAIL → flagged
#    for review. Also classifies cuisine of origin.
python rewrite.py [--limit N]
python rewrite.py --cuisine-only   # cheap origin-classification sweep only

# Anytime: the state of the line.
python report.py
```

If `--images` or `rewrite.py` report nothing to do, the usual reason is
rows still sitting in `qc_status='pending'` — run `qc.py` first. Stations
3 and 4 only ever touch QC-passed rows, so junk never spends API budget.

## Data notes

- **Schema** (`schema.sql`): everything the scraper offers (ingredients +
  groups, times, nutrition, ratings, equipment, keywords, canonical URL…)
  plus derived value computed at ingest (`derive.py`): numeric per-serving
  nutrition, integer servings, course, main ingredient, taste-axis
  estimates, and `cuisine_slug` normalized to the site's hub slugs
  (declared cuisine → dish markers → ingredient signatures; NULL when
  unsure — the LLM sweep fills those, recorded in `cuisine_source`). The
  full raw scraper payload is kept as jsonb, so schema evolution never
  needs a re-scrape.
- **`urls.txt`**: English-market sites only (non-English TLDs removed);
  the QC language gate parks any stragglers in review.
- **Review queue**: `qc_status='review'` rows await a human —
  `UPDATE recipes SET qc_status='pass' WHERE id=…` waves one through.
  Flagged rewrites: set `rewrite_status='retry'` to re-judge.
- **Serving rule**: the site must only ever serve `instructions_rewritten`,
  never scraped `instructions` verbatim (see Legal note).

## API budgets

- **Unsplash**: demo tier 50 requests/hour → ~24 photos/hour (search +
  guideline-required download ping each count). The client paces, watches
  `X-Ratelimit-Remaining`, and stops early rather than slamming the cap —
  re-run hourly, or apply for production (1,000/hour). We hotlink their
  CDN URLs and store photographer credit, per their guidelines.
- **OpenAI** (`gpt-4o-mini` default; `OPENAI_MODEL` overrides): QC verdicts
  and rewrites are single small structured-output calls — a few dollars
  per thousand recipes.
- **Scraping**: 3s pacing per request (including sitemap fetches) — we are
  polite guests on other people's sites.

## Legal note

Scraped recipe *facts* (ingredient lists, times, nutrition) are generally
not copyrightable; instruction prose is the publisher's expression — that's
exactly why the rewrite pass exists. Don't republish scraped instruction
text verbatim; rewrite before serving. Keep `source_url` attribution
forever.
