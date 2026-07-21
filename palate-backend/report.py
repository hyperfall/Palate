"""Catalog overview: python report.py"""
import db

QUERIES = [
    ("Catalog", "SELECT count(*) || ' recipes from ' || count(DISTINCT host) || ' sites' FROM recipes"),
    ("By cuisine", """SELECT coalesce(cuisine_slug,'(unclassified)') || ' — ' || count(*)
        FROM recipes GROUP BY cuisine_slug ORDER BY count(*) DESC LIMIT 15"""),
    ("By course", "SELECT course || ' — ' || count(*) FROM recipes GROUP BY course ORDER BY count(*) DESC"),
    ("By site", "SELECT host || ' — ' || count(*) FROM recipes GROUP BY host ORDER BY count(*) DESC LIMIT 10"),
    ("Pipeline", """SELECT 'photos: ' || count(unsplash_image) || '/' || count(*)
        || ' · rewritten: ' || count(instructions_rewritten) || '/' || count(*)
        || ' · flagged: ' || count(*) FILTER (WHERE rewrite_status='fail') FROM recipes"""),
    ("Nutrition (avg/serving)", """SELECT round(avg(calories)) || ' kcal · ' || round(avg(protein_g)) || 'g protein'
        FROM recipes WHERE calories IS NOT NULL"""),
]

def main() -> None:
    conn = db.connect()
    try:
        for title, sql in QUERIES:
            print(f"\n── {title} " + "─" * (40 - len(title)))
            try:
                with conn.cursor() as cur:
                    cur.execute(sql)
                    for (line,) in cur.fetchall():
                        print(f"  {line}")
            except Exception as error:
                db.rollback(conn)
                print(f"  (query failed: {error})")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
