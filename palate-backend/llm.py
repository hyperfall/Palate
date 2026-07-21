"""LLM instruction rewrite — the step that makes scraped recipes OURS.

Scraped facts (ingredients, times, yields) are usable as-is; instruction
prose is the publisher's expression and must be rewritten before Palate
serves it. This module owns that pass: read rows where
`instructions_rewritten IS NULL`, rewrite the steps in Palate's voice
(imperative, terse, kitchen-readable, one action per step), and write back
`instructions_rewritten` + `rewritten_at`.

Implemented in rewrite.py — the two-pass Creator → Inspector pipeline with a
deterministic numeric guardrail between them. Run `python rewrite.py`.
"""

from rewrite import create_pass, inspect_pass, numeric_guardrail  # noqa: F401
