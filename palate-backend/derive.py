"""Derived value — turning scraped facts into Palate-native data at ingest.

Everything here is computed, not fetched: parsed numeric nutrition, integer
servings, and the editorial facets Palate filters on (course, main
ingredient, and the four taste-axis estimates, 0–5). Same heuristics as the
site's API importers, so scraped rows drop into the catalog without a
second mapping pass. Estimates are exactly that — the site marks imported
provenance accordingly.
"""

import re

# ---- Nutrition ------------------------------------------------------------

_NUM = re.compile(r"(\d+(?:\.\d+)?)")

# schema.org nutrient keys → our column names (grams unless noted)
_NUTRIENT_KEYS = {
    "calories": "calories",
    "proteinContent": "protein_g",
    "carbohydrateContent": "carbs_g",
    "fatContent": "fat_g",
    "sugarContent": "sugar_g",
    "fiberContent": "fiber_g",
    "sodiumContent": "sodium_mg",
}


def parse_nutrients(nutrients: dict | None) -> dict:
    """'238 kcal' → 238.0 — numeric per-serving values from schema.org strings."""
    out = {column: None for column in _NUTRIENT_KEYS.values()}
    for key, column in _NUTRIENT_KEYS.items():
        raw = (nutrients or {}).get(key)
        if not raw:
            continue
        match = _NUM.search(str(raw))
        if not match:
            continue
        value = float(match.group(1))
        # sodium sometimes arrives in grams — normalise to mg. A naive
        # `"g" in text` check is a false-positive trap: "milligrams" contains
        # the letter "g" too, so "500 milligrams" would get multiplied by
        # 1000 a second time. Require "g"/"gram(s)" not preceded by a letter
        # (so it doesn't match the tail of "mg"/"milligram") to call it grams.
        raw_text = str(raw).lower()
        is_mg = bool(re.search(r"\bmg\b|milligram", raw_text))
        is_g = bool(re.search(r"(?<![a-z])g(?:rams?)?\b", raw_text))
        if column == "sodium_mg" and is_g and not is_mg:
            value *= 1000
        out[column] = value
    return out


def parse_servings(yields: str | None) -> int | None:
    """'2 servings' / 'Serves 4' / '12 muffins' → leading integer."""
    if not yields:
        return None
    match = _NUM.search(yields)
    return int(float(match.group(1))) if match else None


# ---- Palate facets --------------------------------------------------------

_COURSES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"dessert|cake|cookie|sweet|pudding|ice cream", re.I), "dessert"),
    (re.compile(r"breakfast|brunch", re.I), "breakfast"),
    (re.compile(r"side|salad|condiment|sauce|dip", re.I), "side"),
    (re.compile(r"snack|appetizer|starter|finger", re.I), "snack"),
    (re.compile(r"lunch", re.I), "lunch"),
]

_MAIN_INGREDIENTS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"\bchicken\b", re.I), "chicken"),
    (re.compile(r"\b(beef|steak|brisket|oxtail|mince)\b", re.I), "beef"),
    (re.compile(r"\b(pork|bacon|ham|chorizo|sausage|pancetta)\b", re.I), "pork"),
    (re.compile(r"\b(lamb|mutton|goat)\b", re.I), "lamb"),
    (re.compile(r"\b(fish|prawn|shrimp|salmon|tuna|cod|squid|crab|mussel|anchov)\b", re.I), "seafood"),
    (re.compile(r"\btofu|tempeh\b", re.I), "tofu-tempeh"),
    (re.compile(r"\b(chickpea|lentil|black bean|kidney bean|cannellini|beans?)\b", re.I), "legumes"),
    (re.compile(r"\b(noodle|pasta|spaghetti|macaroni|penne|linguine|udon|soba|orzo)\b", re.I), "pasta-noodles"),
    (re.compile(r"\b(paneer|halloumi|feta|mozzarella|cheddar|parmesan|cheese)\b", re.I), "cheese-dairy"),
    (re.compile(r"\b(rice|quinoa|barley|bulgur|couscous)\b", re.I), "rice-grains"),
    (re.compile(r"\beggs?\b", re.I), "eggs"),
]

_HEAT = re.compile(
    r"chill?i|cayenne|sriracha|gochujang|jalape|habanero|harissa|curry paste|szechuan|sichuan|pepper flakes|hot sauce|scotch bonnet|sambal",
    re.I,
)
_SWEET = re.compile(r"\b(sugar|honey|maple|condensed milk|golden syrup|jam|molasses)\b", re.I)
_RICH = re.compile(
    r"\b(cream|butter|ghee|coconut milk|coconut cream|cheese|lard|mascarpone|bacon|tahini|peanut butter)\b",
    re.I,
)


# ---- Cuisine → Palate hub slug -------------------------------------------

# Declared-cuisine aliases (schema.org recipeCuisine is freeform).
_CUISINE_ALIASES = {
    # Multiword/трicky aliases FIRST — matching is ordered and word-boundary.
    "west indian": "caribbean", "east asian": "pan-asian",
    "south asian": "indian", "southeast asian": "southeast-asian",
    "japanese": "japanese", "korean": "korean", "chinese": "chinese",
    "thai": "thai", "vietnamese": "vietnamese", "indian": "indian",
    "italian": "italian", "french": "french", "greek": "greek",
    "spanish": "spanish", "mexican": "mexican", "american": "american",
    "british": "british", "english": "british", "german": "german",
    "irish": "irish", "nordic": "nordic", "scandinavian": "nordic",
    "caribbean": "caribbean", "cajun": "cajun", "creole": "cajun",
    "african": "african", "jewish": "jewish", "mediterranean": "mediterranean",
    "middle eastern": "levantine", "lebanese": "levantine", "levantine": "levantine",
    "turkish": "levantine", "moroccan": "african", "southern": "southern-us",
    "asian": "pan-asian", "european": "pan-european", "eastern european": "eastern-european",
    "polish": "eastern-european", "russian": "eastern-european",
    "latin american": "latin-american", "peruvian": "latin-american",
    "brazilian": "latin-american", "filipino": "southeast-asian",
    "indonesian": "southeast-asian", "malaysian": "southeast-asian",
}

# Dish/title markers, checked in the title + keywords + category text.
_CUISINE_MARKERS: list[tuple[re.Pattern, str]] = [
    (re.compile(r"ramen|sushi|teriyaki|katsu|udon|miso|donburi|yakitori", re.I), "japanese"),
    (re.compile(r"kimchi|bulgogi|bibimbap|gochujang|tteok", re.I), "korean"),
    (re.compile(r"stir.?fry|wonton|dumpling|mapo|szechuan|sichuan|chow mein|lo mein", re.I), "chinese"),
    (re.compile(r"pad thai|tom yum|satay|massaman|green curry|red curry", re.I), "thai"),
    (re.compile(r"pho|banh mi|spring roll", re.I), "vietnamese"),
    (re.compile(r"tikka|masala|biryani|dal|paneer|korma|vindaloo|naan", re.I), "indian"),
    (re.compile(r"pasta|risotto|lasagn|gnocchi|carbonara|parmigiana|bruschetta", re.I), "italian"),
    (re.compile(r"ratatouille|coq au vin|crêpe|crepe|béarnaise|provençal", re.I), "french"),
    (re.compile(r"gyro|tzatziki|souvlaki|moussaka|feta salad", re.I), "greek"),
    (re.compile(r"paella|gazpacho|tapas|chorizo rice", re.I), "spanish"),
    (re.compile(r"taco|burrito|enchilada|quesadilla|salsa verde|fajita|carnitas", re.I), "mexican"),
    (re.compile(r"hummus|falafel|shawarma|tabbouleh|baba ghanoush|za.?atar", re.I), "levantine"),
    (re.compile(r"jerk|plantain", re.I), "caribbean"),
    (re.compile(r"gumbo|jambalaya|étouffée|etouffee", re.I), "cajun"),
    (re.compile(r"jollof|tagine|berbere|suya|injera", re.I), "african"),
    (re.compile(r"goulash|pierogi|borscht|schnitzel", re.I), "eastern-european"),
]

# Ingredient signatures — the last resort, weakest signal.
_CUISINE_SIGNATURES: list[tuple[re.Pattern, str]] = [
    (re.compile(r"gochujang|gochugaru|kimchi", re.I), "korean"),
    (re.compile(r"miso|dashi|mirin|sake\b", re.I), "japanese"),
    (re.compile(r"fish sauce.*lime|lemongrass|galangal", re.I | re.S), "thai"),
    (re.compile(r"garam masala|turmeric.*cumin|curry leaves|ghee", re.I | re.S), "indian"),
    (re.compile(r"hoisin|oyster sauce|shaoxing|five.?spice", re.I), "chinese"),
    (re.compile(r"parmesan.*basil|pecorino|guanciale", re.I | re.S), "italian"),
    (re.compile(r"tortilla|jalape|chipotle|queso", re.I), "mexican"),
    (re.compile(r"tahini|sumac|pomegranate molasses", re.I), "levantine"),
    (re.compile(r"feta.*olive|halloumi", re.I | re.S), "greek"),
    # Weakest tier: pan-Asian pantry staples with no single-country signal.
    (re.compile(r"sriracha|sesame oil.*soy sauce|soy sauce.*sesame", re.I | re.S), "pan-asian"),
]


def derive_cuisine_slug(
    declared: str | None,
    title: str,
    keywords: list[str] | None,
    category: str | None,
    ingredients: list[str],
) -> str | None:
    """Palate hub slug via declared cuisine → dish markers → ingredient
    signatures. NULL when nothing matches — honest beats wrong."""
    if declared:
        d = declared.lower()
        for alias, slug in _CUISINE_ALIASES.items():
            if re.search(rf"\b{re.escape(alias)}\b", d):
                return slug
    hints = " ".join(filter(None, [title, " ".join(keywords or []), category or ""]))
    for pattern, slug in _CUISINE_MARKERS:
        if pattern.search(hints):
            return slug
    ingredient_text = " ".join(ingredients)
    for pattern, slug in _CUISINE_SIGNATURES:
        if pattern.search(ingredient_text):
            return slug
    return None


def derive_facets(
    category: str | None,
    keywords: list[str] | None,
    ingredients: list[str],
    instructions: list[str],
) -> dict:
    hint_text = " ".join(filter(None, [category or "", " ".join(keywords or [])]))
    course = next((name for pattern, name in _COURSES if pattern.search(hint_text)), "dinner")

    ingredient_text = " ".join(ingredients)
    main = next(
        (name for pattern, name in _MAIN_INGREDIENTS if pattern.search(ingredient_text)),
        "vegetables",
    )

    heat_hits = len(_HEAT.findall(ingredient_text))
    spiciness = 4 if heat_hits >= 2 else 3 if heat_hits == 1 else (
        2 if re.search(r"curry powder|paprika", ingredient_text, re.I) else 0
    )
    sweetness = 5 if course == "dessert" else min(len(_SWEET.findall(ingredient_text)), 2)
    richness = min(len(_RICH.findall(ingredient_text)) + 1, 5)
    steps = len(instructions)
    effort = 1 if steps <= 4 else 2 if steps <= 7 else 3 if steps <= 11 else 4

    return {
        "course": course,
        "main_ingredient": main,
        "spiciness": spiciness,
        "sweetness": sweetness,
        "richness": richness,
        "effort": effort,
    }
