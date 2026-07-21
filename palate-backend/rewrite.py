"""The Generative Chef pipeline: Create → Inspect → save or flag.

  python rewrite.py [--limit N]   rewrite rows where instructions_rewritten IS NULL

Two-pass design:
  1. CREATOR  — rewrites the scraped steps in Palate's voice (sophisticated,
     witty, technically exact). Structured output, so the database stays clean.
  2. INSPECTOR — treats the Creator's work as suspect: verifies every
     temperature, timing, and ingredient survived, and that nothing was
     invented. FAIL → the row is flagged for human review, never served.

A deterministic guardrail runs between the passes: every number-with-unit
(temperatures, minutes, quantities) found in the original must appear in the
rewrite. Cheap, and catches the classic LLM slip before spending the
Inspector call.

Needs OPENAI_API_KEY in .env (model via OPENAI_MODEL, default gpt-4o-mini).
"""

import os
import re
import sys
from typing import Literal

from dotenv import load_dotenv
from openai import OpenAI, OpenAIError
from pydantic import BaseModel

import db

load_dotenv()

MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")

CREATOR_SYSTEM = """You are Palate's culinary editor: a world-class recipe writer known for
sophisticated, dry wit and total technical precision. You rewrite scraped recipe
instructions into Palate's voice — delightful to read at a glance from across a kitchen
counter, and strictly accurate.

Rules, non-negotiable:
1. Preserve exact chemical and physical integrity: every temperature, time, quantity,
   and technique stays identical to the original.
2. Strip all blog filler, anecdotes, and apologies.
3. One clear action per step; merge trivial steps, split run-ons.
4. Never copy sentences through — new prose, same cooking.
5. UK English. No "simply". Wit is seasoning, not the dish: at most a light touch per step.
6. Keep the original's units as written; you MAY append a correct metric conversion in
   parentheses, e.g. "350°F (180°C)" — never replace, never convert wrongly.
7. Options stay options: if the original offers alternatives (alcoholic or not, cloves
   studded or floating) or MULTIPLE COOKING METHODS (stovetop and Instant Pot, oven and
   air fryer), preserve every path — never keep one and drop the rest.
8. Add NOTHING the original does not contain — no invented garnishes, serving
   suggestions, or "finishing touches". Your flourish is the prose, never the food.
9. NEVER invent a value the original omits. If it just says "roast in a hot oven",
   so do you — a fabricated temperature is the worst possible error.
10. The COMPLETE method must survive: every step of the original appears in your
   rewrite. Truncating the back half of a recipe is a total failure.
11. If the ingredient list and the steps disagree on a quantity, follow the STEPS —
   they are the method; note nothing.

Example of the register: instead of "Add the butter to the pan", write
"Introduce the butter to the pan with a sense of purpose — it is the foundation of
everything that follows." Clear first, elevated second.

You also identify the dish's cuisine of origin from the allowed list — the single
best answer based on the dish itself, not where the blog author lives. Use
"unknown" only when the dish genuinely belongs nowhere in particular."""

INSPECTOR_SYSTEM = """You are a detail-oriented Food Safety and Quality Assurance officer.
You verify that a rewritten recipe is safe and technically EQUIVALENT to the original.

FAIL only for real changes: altered temperatures, altered times, altered quantities,
ingredients dropped from use, or ingredients invented. Do NOT fail for phrasing
differences that keep the same referent — "grape tomatoes" vs "tomatoes",
"sauté" vs "fry", reordered prep of independent components, or merged/split steps
with identical content. Rewording is the point; only the cooking must be identical.

Numerically equivalent unit conversions are NOT changes: 350°F = 180°C, 325°F = 160°C,
240ml = 1 cup. Standard kitchen rounding applies — a conversion within ±3°C / ±5°F of
exact is CORRECT (375°F = 190°C). Flag only conversions wrong enough to change the
cooked result. Options in the original (either/or choices) must remain options.

The recipe's ingredient list is authoritative context: a rewrite that names an
ingredient more precisely than the original steps did ("blueberries" → "freeze-dried
blueberries") is NOT an invention if that ingredient appears in the list.

Report violations as a list of concrete changes that would alter the cooked result.
An empty list means the rewrite is equivalent. NEVER list an item you yourself judge
correct, unchanged, or equivalent — the list is only for genuine changes."""


# Palate's cuisine hubs — structured output constrains the LLM to these, so a
# classification can never be an invalid slug. "unknown" = genuinely ambiguous.
CuisineSlug = Literal[
    "japanese", "korean", "chinese", "thai", "vietnamese", "southeast-asian",
    "pan-asian", "indian", "italian", "french", "greek", "spanish",
    "mediterranean", "levantine", "eastern-european", "pan-european", "german",
    "irish", "british", "nordic", "jewish", "african", "caribbean", "cajun",
    "american", "southern-us", "mexican", "latin-american", "unknown",
]


class Rewrite(BaseModel):
    steps: list[str]
    voice_check: str  # five-ish words confirming the register
    cuisine_slug: CuisineSlug  # the dish's cuisine of origin


class Classification(BaseModel):
    cuisine_slug: CuisineSlug
    reasoning: str  # one sentence — why this origin


class InspectionReport(BaseModel):
    # Each entry is one CONCRETE change that would alter the cooked result.
    # Empty list = the rewrite is equivalent. The verdict is derived in code,
    # so reasoning and status can never disagree.
    violations: list[str]
    summary: str


class Inspection(BaseModel):
    status: Literal["PASS", "FAIL"]
    reason: str


# Constructed lazily so the missing-key case reaches main()'s friendly message
# instead of crashing at import time.
_client: OpenAI | None = None


def get_client() -> OpenAI:
    global _client
    if _client is None:
        _client = OpenAI()
    return _client


def create_pass(
    title: str,
    ingredients: list[str],
    instructions: list[str],
    feedback: tuple[list[str], str] | None = None,
) -> Rewrite:
    response = get_client().chat.completions.parse(
        model=MODEL,
        messages=[
            {"role": "system", "content": CREATOR_SYSTEM},
            {
                "role": "user",
                "content": (
                    f"Title: {title}\n\n"
                    f"Ingredients:\n" + "\n".join(f"- {i}" for i in ingredients) + "\n\n"
                    f"Original instructions:\n"
                    + "\n".join(f"{n}. {s}" for n, s in enumerate(instructions, 1))
                    + (
                        "\n\nYOUR PREVIOUS ATTEMPT WAS REJECTED BY QA.\n"
                        "Previous attempt:\n" + "\n".join(feedback[0]) + "\n"
                        "Rejection reason: " + feedback[1] + "\n"
                        "Produce a corrected rewrite that fixes exactly this, "
                        "keeping the voice and every other constraint."
                        if feedback
                        else ""
                    )
                ),
            }
        ],
        max_completion_tokens=4096,
        response_format=Rewrite,
    )
    return response.choices[0].message.parsed


# Vulgar fractions and spelled-out quantities both normalise to a/b form so
# "¼ cup", "1/4 cup", and "quarter cup" all compare equal.
_VULGar_MAP = {
    "¼": "1/4", "½": "1/2", "¾": "3/4", "⅓": "1/3", "⅔": "2/3",
    "⅛": "1/8", "⅜": "3/8", "⅝": "5/8", "⅞": "7/8",
    "quarter": "1/4", "half": "1/2", "third": "1/3",
}


_WORD_FRACTIONS = re.compile(r"\b(?:one[\s-])?(quarter|half|third)\b")
_WORD_FRACTION_VALUES = {"quarter": "1/4", "half": "1/2", "third": "1/3"}

# The unit vocabulary, shared by every matcher below.
_UNIT_ALT = (
    r"[°º]\s?[cf]|degrees?(?:\s(?:fahrenheit|celsius|[cf]\b))?|f"
    r"|minutes?|mins?|seconds?|secs?|hours?|hrs?"
    r"|kilograms?|kg|grams?|g|millilit(?:er|re)s?|ml|lit(?:er|re)s?|l"
    r"|pounds?|lbs?|ounces?|oz|cups?|tablespoons?|tbsp|teaspoons?|tsp"
)

_WORD_NUMBERS = {
    "one": "1", "two": "2", "three": "3", "four": "4", "five": "5", "six": "6",
    "seven": "7", "eight": "8", "nine": "9", "ten": "10", "eleven": "11", "twelve": "12",
}
_WORD_NUMBER_RE = re.compile(r"\b(" + "|".join(_WORD_NUMBERS) + r")\b")
# "an hour", "a cup" — the article IS the number 1.
# "a cup" is a quantity; "a second bowl" is an ordinal — seconds excluded.
_ARTICLE_UNITS = _UNIT_ALT.replace("|seconds?|secs?", "")
_ARTICLE_UNIT_RE = re.compile(rf"\ban?\s+(?=(?:{_ARTICLE_UNITS})\b)")
# "350-375°F" / "25 to 30 minutes" → both endpoints get the unit.
_NUM_PAT = r"(?:\d+\s+\d+/\d+|\d+/\d+|\d+(?:\.\d+)?)"
_RANGE_RE = re.compile(rf"({_NUM_PAT})\s?(?:-|–|—|to)\s?({_NUM_PAT})([-\s]?(?:{_UNIT_ALT})\b)")


def _normalise(text: str) -> str:
    """Lowercase; vulgar + worded fractions → a/b; worded numbers → digits;
    "an hour" → "1 hour"; ranges expanded so both endpoints carry the unit.
    Word-boundary aware throughout ("quartered"/"halfway" stay untouched)."""
    text = text.lower()
    for glyph, ascii_frac in _VULGar_MAP.items():
        if len(glyph) == 1:  # vulgar glyphs only; words handled below
            text = text.replace(glyph, " " + ascii_frac + " ")
    # Order matters: "one half" must become 1/2 before "one" becomes "1".
    text = _WORD_FRACTIONS.sub(lambda m: " " + _WORD_FRACTION_VALUES[m.group(1)] + " ", text)
    text = _WORD_NUMBER_RE.sub(lambda m: _WORD_NUMBERS[m.group(1)], text)
    text = _ARTICLE_UNIT_RE.sub("1 ", text)
    text = _RANGE_RE.sub(r"\1\3 \2\3", text)
    return re.sub(r"\s+", " ", text)


# Every notation of a unit collapses to one canonical token, so "4 tbsp" ==
# "4 tablespoons", "400°F" == "400 F" == "400 degrees Fahrenheit".
_UNIT_CANON = [
    (re.compile(r"^(?:[°º]\s?|degrees?\s?)?f(?:ahrenheit)?$"), "f"),
    (re.compile(r"^(?:[°º]\s?|degrees?\s?)?c(?:elsius)?$"), "c"),
    (re.compile(r"^degrees?$"), "deg"),
    (re.compile(r"^min(?:ute)?s?$"), "min"),
    (re.compile(r"^sec(?:ond)?s?$"), "sec"),
    (re.compile(r"^(?:hour|hr)s?$"), "hr"),
    (re.compile(r"^(?:tablespoon|tbsp)s?$"), "tbsp"),
    (re.compile(r"^(?:teaspoon|tsp)s?$"), "tsp"),
    (re.compile(r"^cups?$"), "cup"),
    (re.compile(r"^(?:gram|g)s?$"), "g"),
    (re.compile(r"^(?:kilogram|kg)s?$"), "kg"),
    (re.compile(r"^(?:millilit(?:er|re)|ml)s?$"), "ml"),
    (re.compile(r"^(?:lit(?:er|re)|l)s?$"), "l"),
    (re.compile(r"^(?:pound|lb)s?$"), "lb"),
    (re.compile(r"^(?:ounce|oz)s?$"), "oz"),
]


def _canon_unit(raw: str) -> str:
    raw = raw.strip().lower()
    for pattern, canonical in _UNIT_CANON:
        if pattern.match(raw):
            return canonical
    return raw


def numeric_guardrail(original: list[str], rewritten: list[str]) -> str | None:
    """Every number+unit in the original must survive — temperatures, times,
    AND quantities. Fraction-aware and notation-blind: "1/4 cup" == "¼ cup",
    "4 tablespoons" == "4 tbsp", "400°F" == "400 degrees Fahrenheit".
    Returns an error or None."""
    quantity_re = re.compile(
        rf"(?<![\d/.])((?:\d+\s+)?\d+/\d+|\d+(?:\.\d+)?)[-\s]?(?:of\s)?(?:an?\s)?"
        rf"({_UNIT_ALT})\b",
        re.I,
    )

    _TIME_SECONDS = {"sec": 1, "min": 60, "hr": 3600}

    def _value(raw: str) -> str:
        raw = raw.strip()
        m = re.match(r"^(\d+)\s+(\d+)/(\d+)$", raw)
        if m:
            v = int(m.group(1)) + int(m.group(2)) / int(m.group(3))
        elif "/" in raw:
            a, b = raw.split("/")
            v = int(a) / int(b)
        else:
            v = float(raw)
        return f"{round(v, 3):g}"

    def keys(text: str) -> set[str]:
        normalised = _normalise(text)
        out = set()
        for m in quantity_re.finditer(normalised):
            # "a cup or two" is an approximation, not a requirement.
            if re.match(r"\s?or\s(?:a\s)?(?:two|three|\d)", normalised[m.end():]):
                continue
            unit = _canon_unit(m.group(2))
            value = _value(m.group(1))
            if unit in _TIME_SECONDS:
                out.add(f"{float(value) * _TIME_SECONDS[unit]:g}sec")
            else:
                out.add(value + unit)
        return out

    # Anecdotes in parentheses ("(I got about 1 tablespoon…)") are blog
    # filler the Creator is INSTRUCTED to strip — their quantities are not
    # load-bearing. Functional parentheticals ("(180°C)") carry no pronouns.
    def strip_asides(text: str) -> str:
        # Parenthetical anecdotes, then whole first-person sentences ("Note: I
        # am still without an oven…") — blog voice, not method. Imperative
        # recipe steps never say I/my/we.
        text = re.sub(r"\([^)]*\b(?:i|i'd|i've|my|we)\b[^)]*\)", " ", text, flags=re.I)
        # Educational riffs ("The rule of thumb is 1/2 tsp per pound, but…")
        # explain; they don't instruct. Their numbers aren't load-bearing.
        text = re.sub(r"[^.!?]*rule of thumb[^.!?]*[.!?]", " ", text, flags=re.I)
        return re.sub(r"[^.!?]*\b(?:i|i'd|i've|my|we)\b[^.!?]*[.!?]", " ", text, flags=re.I)

    original_keys = keys(strip_asides(" ".join(original)))
    new_keys = keys(strip_asides(" ".join(rewritten)))

    def satisfied(hit: str) -> bool:
        if hit in new_keys:
            return True
        # "350 degrees" (scale unknown) ≡ "350°F" / "350°C", in both directions.
        for suffix, family in (("deg", ("f", "c", "deg")), ("f", ("deg",)), ("c", ("deg",))):
            if hit.endswith(suffix):
                number = hit[: -len(suffix)]
                return any(number + alt in new_keys for alt in family)
        return False

    missing = sorted(h for h in original_keys if not satisfied(h))
    return f"missing from rewrite: {', '.join(missing)}" if missing else None


CLASSIFY_SYSTEM = """You are a culinary historian. Given a recipe, identify the cuisine of
origin of the dish itself — the tradition it comes from, not the nationality of the
website. Choose the single best answer from the allowed values; "unknown" only when
the dish genuinely has no clear origin."""


def classify_pass(title: str, ingredients: list[str], instructions: list[str]) -> Classification:
    response = get_client().chat.completions.parse(
        model=MODEL,
        messages=[
            {"role": "system", "content": CLASSIFY_SYSTEM},
            {
                "role": "user",
                "content": (
                    f"Title: {title}\n\nIngredients:\n"
                    + "\n".join(f"- {i}" for i in ingredients)
                    + "\n\nMethod:\n" + "\n".join(instructions)
                ),
            }
        ],
        max_completion_tokens=4096,
        response_format=Classification,
    )
    return response.choices[0].message.parsed


def inspect_pass(
    original: list[str], rewritten: list[str], ingredients: list[str] | None = None
) -> Inspection:
    response = get_client().chat.completions.parse(
        model=MODEL,
        messages=[
            {"role": "system", "content": INSPECTOR_SYSTEM},
            {
                "role": "user",
                "content": (
                    "Compare the Original and New instructions.\n\n"
                    "CHECKLIST — report a violation only for:\n"
                    "1. An ingredient used in the original but missing from the new version.\n"
                    "2. A changed timing.\n"
                    "3. A changed temperature (equivalent conversions are fine).\n"
                    "4. An invented ingredient or step that changes the dish.\n\n"
                    + ("Ingredient list (authoritative):\n" + "\n".join(ingredients) + "\n\n" if ingredients else "")
                    + "Original:\n" + "\n".join(original) + "\n\n"
                    "New:\n" + "\n".join(rewritten)
                ),
            }
        ],
        max_completion_tokens=4096,
        response_format=InspectionReport,
    )
    report = response.choices[0].message.parsed
    # Self-negating entries ("…(correct)", "unchanged") are not violations.
    def _conversion_pedantry(v: str) -> bool:
        # If the violation cites an F and a C value that ARE equivalent within
        # kitchen rounding (±8°F), it's pedantry, not a violation.
        f = re.search(r"(\d+(?:\.\d+)?)\s?[°º]?\s?f\b", v, re.I)
        c = re.search(r"(\d+(?:\.\d+)?)\s?[°º]?\s?c\b", v, re.I)
        if f and c:
            return abs(float(c.group(1)) * 9 / 5 + 32 - float(f.group(1))) <= 8
        return False

    report.violations = [
        v for v in report.violations
        if not re.search(r"\(correct\)|\bunchanged\b|\bcorrectly\b|no change|not a change|remains? the same|\bequivalent\b", v, re.I)
        and not _conversion_pedantry(v)
    ]
    # Verdict derived, never asserted: violations decide.
    if report.violations:
        return Inspection(status="FAIL", reason="; ".join(report.violations))
    return Inspection(status="PASS", reason=report.summary)


def _limit_arg(argv: list[str], default: int) -> int:
    if "--limit" not in argv:
        return default
    idx = argv.index("--limit")
    if idx + 1 >= len(argv):
        print("--limit requires a number, e.g. --limit 20")
        sys.exit(1)
    try:
        return int(argv[idx + 1])
    except ValueError:
        print(f"--limit value must be an integer, got {argv[idx + 1]!r}")
        sys.exit(1)


def main() -> None:
    if not os.environ.get("OPENAI_API_KEY"):
        print("OPENAI_API_KEY is not set — add it to palate-backend/.env")
        sys.exit(1)

    limit = _limit_arg(sys.argv, 50)

    conn = db.connect()
    try:
        # Lightweight mode: classify origin for rows the heuristics couldn't
        # place, without paying for a full rewrite. `rewrite.py --cuisine-only`
        if "--cuisine-only" in sys.argv:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT id, title, ingredients, instructions FROM recipes WHERE qc_status = 'pass' AND cuisine_slug IS NULL ORDER BY id LIMIT %s",
                    (limit,),
                )
                rows = cur.fetchall()
            placed = 0
            for recipe_id, title, ingredients, instructions in rows:
                try:
                    verdict = classify_pass(title, ingredients, instructions)
                    if verdict.cuisine_slug != "unknown":
                        with conn.cursor() as cur:
                            cur.execute(
                                "UPDATE recipes SET cuisine_slug = %s, cuisine_source = 'llm' WHERE id = %s",
                                (verdict.cuisine_slug, recipe_id),
                            )
                        conn.commit()
                        placed += 1
                    print(f"  {'✓' if verdict.cuisine_slug != 'unknown' else '?'} {title} → {verdict.cuisine_slug} ({verdict.reasoning})")
                except OpenAIError as error:
                    print(f"  ✗ {title} — API error: {error}")
                except Exception as error:  # one bad row must never kill the batch
                    db.rollback(conn)
                    print(f"  ✗ {title} — unexpected error: {error}")
            print(f"\nDone — {placed} of {len(rows)} placed.")
            return
        with conn.cursor() as cur:
            cur.execute(
                """SELECT id, title, ingredients, instructions FROM recipes
                   WHERE qc_status = 'pass' AND instructions_rewritten IS NULL
                     AND (rewrite_status IS NULL OR rewrite_status = 'retry')
                   ORDER BY id LIMIT %s""",
                (limit,),
            )
            rows = cur.fetchall()

        passed = failed = 0
        for recipe_id, title, ingredients, instructions in rows:
            try:
                rewrite = create_pass(title, ingredients, instructions)

                def judge(attempt: Rewrite) -> Inspection:
                    guard_error = numeric_guardrail(instructions, attempt.steps)
                    if guard_error:
                        return Inspection(status="FAIL", reason=f"guardrail: {guard_error}")
                    return inspect_pass(instructions, attempt.steps, ingredients)

                verdict = judge(rewrite)
                if verdict.status == "FAIL":
                    # The repair loop: hand the Creator its rejection, once.
                    rewrite = create_pass(
                        title, ingredients, instructions, feedback=(rewrite.steps, verdict.reason)
                    )
                    verdict = judge(rewrite)

                with conn.cursor() as cur:
                    if verdict.status == "PASS":
                        cur.execute(
                            """UPDATE recipes SET instructions_rewritten = %s,
                               rewritten_at = now(), rewrite_status = 'pass',
                               rewrite_reason = NULL WHERE id = %s""",
                            (rewrite.steps, recipe_id),
                        )
                        # The LLM read the whole recipe — its origin call outranks
                        # the ingest regexes whenever it commits to an answer.
                        if rewrite.cuisine_slug != "unknown":
                            cur.execute(
                                "UPDATE recipes SET cuisine_slug = %s, cuisine_source = 'llm' WHERE id = %s",
                                (rewrite.cuisine_slug, recipe_id),
                            )
                        passed += 1
                        print(f"  ✓ {title} — {rewrite.voice_check}")
                    else:
                        cur.execute(
                            """UPDATE recipes SET rewrite_status = 'fail', rewrite_reason = %s,
                               rewrite_attempt = %s WHERE id = %s""",
                            (verdict.reason, rewrite.steps, recipe_id),
                        )
                        failed += 1
                        print(f"  ✗ {title} — {verdict.reason}")
                conn.commit()
            except OpenAIError as error:
                db.rollback(conn)
                print(f"  ✗ {title} — API error: {error}")
            except Exception as error:  # one bad row must never kill the batch
                db.rollback(conn)
                print(f"  ✗ {title} — unexpected error: {error}")

        print(f"\nDone — {passed} rewritten, {failed} flagged for review.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
