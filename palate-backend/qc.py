"""Factory QC: python qc.py [--limit N]

Every scraped row starts qc_status='pending'. This station runs:
  1. MACHINE CHECK (free): is this food at all? Craft/DIY posts carry
     recipe-shaped markup — glue and cardstock are not ingredients.
  2. LLM CHECK (cheap, structured): uncertain rows get a yes/no verdict.
Verdicts: pass | rejected | review (human queue). Downstream stations
(images, rewrite) only touch qc_status='pass'.
"""

import re
import sys

from dotenv import load_dotenv
from pydantic import BaseModel

import db

load_dotenv()

_CRAFT = re.compile(
    r"cardstock|glue|paint|glitter|ribbon|yarn|fabric|hammer|nail|scissors|"
    r"printable|craft|DIY|greeting card|candle|soap|slime|playdough|play-doh",
    re.I,
)
_FOOD = re.compile(
    r"salt|pepper|oil|butter|sugar|flour|garlic|onion|egg|milk|water|cream|"
    r"chicken|beef|rice|tomato|cheese|lemon|soy|vinegar|honey|stock|broth",
    re.I,
)


_ROUNDUP = re.compile(r"\b\d+\s+(best|easy|amazing|favou?rite)?\s*\w*\s*recipes\b|recipes? (to|for|you)|round.?up|\bideas\b|\bgift guide\b", re.I)
_NONFOOD = re.compile(r"dog|puppy|cat treat|pet\b|soap|lotion|bath bomb|scrub|candle|cleaner|detergent|laundry|slime", re.I)


class Verdict(BaseModel):
    is_edible_recipe: bool      # food for humans, not crafts/pets/cosmetics
    is_single_recipe: bool      # one dish, not a roundup/collection page
    is_complete: bool           # ingredients and method actually cook the dish
    quality_score: int          # 1-5: would a serious food site publish this?
    reason: str


def machine_check(title: str, ingredients: list[str], instructions: list[str]) -> tuple[str, str]:
    """Hard structural + content gate. Only ever rejects or escalates — a pass
    verdict is the LLM's to give, never keyword counting's."""
    if len(ingredients) < 3:
        return "rejected", f"machine: only {len(ingredients)} ingredients"
    if len(instructions) < 2 or sum(len(s) for s in instructions) < 80:
        return "rejected", "machine: method too thin to cook from"
    if _ROUNDUP.search(title):
        return "rejected", "machine: roundup/collection page, not a single recipe"
    text = title + " " + " ".join(ingredients)
    if _NONFOOD.search(text):
        return "rejected", "machine: non-food product (pet/cosmetic/cleaning/craft)"
    crafts = len(_CRAFT.findall(text))
    foods = len(_FOOD.findall(" ".join(ingredients)))
    if crafts >= 2 and crafts > foods:
        return "rejected", f"machine: craft markers ({crafts}) outweigh food ({foods})"
    return "uncertain", ""


def llm_check(title: str, ingredients: list[str], instructions: list[str]) -> Verdict:
    from rewrite import get_client, MODEL

    response = get_client().chat.completions.parse(
        model=MODEL,
        messages=[
            {"role": "system", "content": "You are the quality gate for a serious food publication. Judge strictly: edible human food only (no crafts, pets, cosmetics, cleaning); a single dish, not a listicle; a method a stranger could actually cook from; quality_score 5 = publish proudly, 1 = embarrassing."},
            {"role": "user", "content": f"Title: {title}\nIngredients:\n" + "\n".join(f"- {i}" for i in ingredients) + "\n\nMethod:\n" + "\n".join(instructions)},
        ],
        response_format=Verdict,
    )
    return response.choices[0].message.parsed


def _limit_arg(argv: list[str], default: int) -> int:
    if "--limit" not in argv:
        return default
    idx = argv.index("--limit")
    if idx + 1 >= len(argv):
        print("--limit requires a number, e.g. --limit 100")
        sys.exit(1)
    try:
        return int(argv[idx + 1])
    except ValueError:
        print(f"--limit value must be an integer, got {argv[idx + 1]!r}")
        sys.exit(1)


def language_gate(conn) -> int:
    """English site, English catalog: park non-English rows in review (they
    may be worth translating later — rejection would be destructive)."""
    with conn.cursor() as cur:
        cur.execute(
            """UPDATE recipes SET qc_status = 'review',
               qc_reason = 'machine: non-English (' || language || ') — translate or skip'
               WHERE language IS NOT NULL AND language NOT ILIKE 'en%%'
                 AND qc_status IN ('pending', 'pass')""",
        )
        parked = cur.rowcount
    conn.commit()
    return parked


def main() -> None:
    limit = _limit_arg(sys.argv, 500)
    conn = db.connect()
    try:
        if "--recheck" in sys.argv:
            try:
                with conn.cursor() as cur:
                    cur.execute("UPDATE recipes SET qc_status = 'pending'")
                conn.commit()
            except Exception as error:
                db.rollback(conn)
                print(f"--recheck failed to reset rows: {error}")
                sys.exit(1)
        with conn.cursor() as cur:
            cur.execute(
                "SELECT id, title, ingredients, instructions FROM recipes WHERE qc_status = 'pending' ORDER BY id LIMIT %s",
                (limit,),
            )
            rows = cur.fetchall()

        parked = language_gate(conn)
        if parked:
            print(f"  ⏸ {parked} non-English recipes parked for review")

        tally = {"pass": 0, "rejected": 0, "review": 0}
        for recipe_id, title, ingredients, instructions in rows:
            status, reason = machine_check(title, ingredients, instructions)
            if status == "uncertain":
                try:
                    verdict = llm_check(title, ingredients, instructions)
                    ok = verdict.is_edible_recipe and verdict.is_single_recipe and verdict.is_complete
                    status = "pass" if ok and verdict.quality_score >= 3 else ("review" if ok else "rejected")
                    reason = f"llm q{verdict.quality_score}: {verdict.reason}"
                except Exception as error:
                    status, reason = "review", f"llm unavailable: {error}"
            try:
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE recipes SET qc_status = %s, qc_reason = %s WHERE id = %s",
                        (status, reason, recipe_id),
                    )
                conn.commit()
            except Exception as error:  # one bad row must never kill the batch
                db.rollback(conn)
                print(f"  ✗ {title} — save failed: {error}")
                continue
            tally[status] += 1
            mark = {"pass": "✓", "rejected": "✗", "review": "?"}[status]
            print(f"  {mark} {title} — {reason}")

        print(f"\nQC done — {tally['pass']} passed, {tally['rejected']} rejected, {tally['review']} for human review.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
