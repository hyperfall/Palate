-- Palate's owned recipe store. Plain SQL, cloud-portable.

CREATE TABLE IF NOT EXISTS recipes (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_url    text NOT NULL UNIQUE,
  host          text NOT NULL,
  title         text NOT NULL,
  author        text,
  description   text,
  -- Scraped ingredient lines, verbatim. Facts, not expression.
  ingredients   jsonb NOT NULL DEFAULT '[]',
  ingredient_groups jsonb,
  -- Publisher's instruction steps — internal reference only, never republish.
  instructions  text[] NOT NULL DEFAULT '{}',
  -- The LLM rewrite in Palate's voice; what the site should actually serve.
  instructions_rewritten text[],
  rewritten_at  timestamptz,
  rewrite_status text,          -- pass | fail | retry (NULL = not attempted)
  rewrite_reason text,          -- Inspector/guardrail verdict when failed
  yields        text,
  total_minutes integer,
  cook_minutes  integer,
  prep_minutes  integer,
  cuisine       text,
  category      text,
  nutrients     jsonb,
  ratings       real,
  ratings_count integer,
  equipment     jsonb,
  cooking_method text,
  dietary_restrictions jsonb,
  keywords      jsonb,
  canonical_url text,
  site_name     text,
  language      text,
  -- Derived at ingest (see derive.py): parsed numerics + Palate facets.
  servings      integer,
  calories      real,
  protein_g     real,
  carbs_g       real,
  fat_g         real,
  sugar_g       real,
  fiber_g       real,
  sodium_mg     real,
  course        text,
  main_ingredient text,
  cuisine_slug  text,          -- normalized to Palate hub slugs (derive.py or LLM)
  cuisine_source text,         -- heuristic | llm
  spiciness     smallint,
  sweetness     smallint,
  richness      smallint,
  effort        smallint,
  scraped_image text,          -- publisher's own photo URL (reference)
  unsplash_image text,         -- our servable quality photo
  unsplash_credit text,        -- photographer attribution (Unsplash requires it)
  -- Factory QC (qc.py): pending → pass | rejected | review. Downstream
  -- stations (images, rewrite) only touch qc_status = 'pass'.
  qc_status     text NOT NULL DEFAULT 'pending',
  qc_reason     text,
  raw           jsonb NOT NULL, -- full scraper payload; schema evolution insurance
  scraped_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recipes_host_idx ON recipes (host);
CREATE INDEX IF NOT EXISTS recipes_cuisine_idx ON recipes (cuisine);
CREATE INDEX IF NOT EXISTS recipes_cuisine_slug_idx ON recipes (cuisine_slug);
