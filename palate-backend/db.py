"""Postgres access for the owned recipe store."""

import os

import psycopg
from psycopg.types.json import Jsonb
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.environ.get(
    "BACKEND_DATABASE_URL", "postgresql://postgres@127.0.0.1:5432/palate_backend"
)


def connect() -> psycopg.Connection:
    return psycopg.connect(DATABASE_URL)


def upsert_recipe(conn: psycopg.Connection, row: dict) -> tuple[int, bool]:
    """Insert or update by source_url. Returns (id, created)."""
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO recipes (
              source_url, host, title, author, description,
              ingredients, ingredient_groups, instructions,
              yields, total_minutes, cook_minutes, prep_minutes,
              cuisine, category, nutrients, ratings, ratings_count,
              equipment, cooking_method, dietary_restrictions, keywords,
              canonical_url, site_name, language, servings,
              calories, protein_g, carbs_g, fat_g, sugar_g, fiber_g, sodium_mg,
              course, main_ingredient, spiciness, sweetness, richness, effort, cuisine_slug,
              scraped_image, raw
            ) VALUES (
              %(source_url)s, %(host)s, %(title)s, %(author)s, %(description)s,
              %(ingredients)s, %(ingredient_groups)s, %(instructions)s,
              %(yields)s, %(total_minutes)s, %(cook_minutes)s, %(prep_minutes)s,
              %(cuisine)s, %(category)s, %(nutrients)s, %(ratings)s, %(ratings_count)s,
              %(equipment)s, %(cooking_method)s, %(dietary_restrictions)s, %(keywords)s,
              %(canonical_url)s, %(site_name)s, %(language)s, %(servings)s,
              %(calories)s, %(protein_g)s, %(carbs_g)s, %(fat_g)s, %(sugar_g)s, %(fiber_g)s, %(sodium_mg)s,
              %(course)s, %(main_ingredient)s, %(spiciness)s, %(sweetness)s, %(richness)s, %(effort)s, %(cuisine_slug)s,
              %(scraped_image)s, %(raw)s
            )
            ON CONFLICT (source_url) DO UPDATE SET
              title = EXCLUDED.title,
              author = EXCLUDED.author,
              description = EXCLUDED.description,
              ingredients = EXCLUDED.ingredients,
              ingredient_groups = EXCLUDED.ingredient_groups,
              instructions = EXCLUDED.instructions,
              yields = EXCLUDED.yields,
              total_minutes = EXCLUDED.total_minutes,
              cook_minutes = EXCLUDED.cook_minutes,
              prep_minutes = EXCLUDED.prep_minutes,
              cuisine = EXCLUDED.cuisine,
              category = EXCLUDED.category,
              nutrients = EXCLUDED.nutrients,
              ratings = EXCLUDED.ratings,
              ratings_count = EXCLUDED.ratings_count,
              equipment = EXCLUDED.equipment,
              cooking_method = EXCLUDED.cooking_method,
              dietary_restrictions = EXCLUDED.dietary_restrictions,
              keywords = EXCLUDED.keywords,
              canonical_url = EXCLUDED.canonical_url,
              site_name = EXCLUDED.site_name,
              language = EXCLUDED.language,
              servings = EXCLUDED.servings,
              calories = EXCLUDED.calories,
              protein_g = EXCLUDED.protein_g,
              carbs_g = EXCLUDED.carbs_g,
              fat_g = EXCLUDED.fat_g,
              sugar_g = EXCLUDED.sugar_g,
              fiber_g = EXCLUDED.fiber_g,
              sodium_mg = EXCLUDED.sodium_mg,
              course = EXCLUDED.course,
              main_ingredient = EXCLUDED.main_ingredient,
              spiciness = EXCLUDED.spiciness,
              sweetness = EXCLUDED.sweetness,
              richness = EXCLUDED.richness,
              effort = EXCLUDED.effort,
              cuisine_slug = EXCLUDED.cuisine_slug,
              scraped_image = EXCLUDED.scraped_image,
              raw = EXCLUDED.raw,
              scraped_at = now()
            RETURNING id, (xmax = 0) AS created
            """,
            {
                **row,
                "ingredients": Jsonb(row["ingredients"]),
                "ingredient_groups": Jsonb(row["ingredient_groups"])
                if row.get("ingredient_groups") is not None
                else None,
                "nutrients": Jsonb(row["nutrients"]) if row.get("nutrients") is not None else None,
                "equipment": Jsonb(row["equipment"]) if row.get("equipment") is not None else None,
                "dietary_restrictions": Jsonb(row["dietary_restrictions"])
                if row.get("dietary_restrictions") is not None
                else None,
                "keywords": Jsonb(row["keywords"]) if row.get("keywords") is not None else None,
                "raw": Jsonb(row["raw"]),
            },
        )
        recipe_id, created = cur.fetchone()
    conn.commit()
    return recipe_id, created


def exists(conn: psycopg.Connection, source_url: str) -> bool:
    with conn.cursor() as cur:
        cur.execute("SELECT 1 FROM recipes WHERE source_url = %s", (source_url,))
        return cur.fetchone() is not None


def rollback(conn: psycopg.Connection) -> None:
    """Best-effort rollback. A dropped connection can make rollback() itself
    raise — that must never take down a batch run, so we swallow it here and
    just report it. Callers still see a usable (if possibly broken) conn."""
    try:
        conn.rollback()
    except Exception as error:
        print(f"  ! rollback failed (connection likely dropped): {error}")
