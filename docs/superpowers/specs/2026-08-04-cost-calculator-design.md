# Cost calculator — design

**Status:** agreed 2026-08-04
**Supersedes:** the price-book settings screen shipped in `22265b3`

## Why this exists

Palate priced every recipe from `costPerServing`: one number per recipe, typed
by hand, in GBP pence, identical for everyone. It could not follow the servings
control and was the same figure whether you shop in London or Lagos.

That was replaced with a real engine (`src/lib/cost.ts`) and 108 researched UK
shelf prices. The engine is sound. What was built on top of it was not: a
settings screen listing 109 ingredients with a price field on each, and a
calculator whose prices were prefilled silently behind a small link.

The verdict on it was *"this is just a dumb calculator"*, and that is right for
two reasons:

1. **The arithmetic was hidden.** A row showed an amount and a total. Where the
   price came from was behind a link nobody clicks, so the number looked like it
   arrived from nowhere.
2. **It answered a question nobody asked.** Knowing a bowl of mapo tofu "costs
   £1.39" changes no decision. The decision people actually face is what a shop
   will cost, and what to cook against a budget.

This design fixes (1) directly and lays the groundwork for (2).

## What survives

Not a rewrite. These are correct and stay untouched:

- `src/lib/cost.ts` — `computeCost()`, 22 tests. Unit conversion, per-piece
  pricing, the refusal to guess.
- `src/lib/money.ts` — `Money`, minor units, 72-country currency map, 22 tests.
- `src/lib/priceBook.ts` — baseline + user price merging.
- `ingredient_prices` — the household-shared price book table, trigger and RLS.
- The `price` group on the Ingredients collection, and the 108 researched
  prices with their sources.
- `CostPanel` on recipe pages.

## What is removed

- `src/components/PriceBookEditor.tsx` — the 109-row settings list. Nobody sits
  down to fill in a price list; deleting it is the point of this design.

## 1. The row

Two facts, both always visible:

```
[img] Chicken thighs                                    ✕
      I paid £5.95  for  640 g  │  uses  300 g  =  £2.79
      ours: Sainsbury's 640g — tap to use
```

- **Purchase** — `priceMinor`, `packAmount`, `packUnit`. What you paid for what.
- **Usage** — `useAmount`, `useUnit`. What this dish takes.
- **Cost** — derived, never stored.

The total must be visibly the sum of arithmetic on screen. No hidden state.

### Catalogue rows vs free-text rows

| | catalogue row | free-text row |
|---|---|---|
| identified by | `slug` | `label` only |
| thumbnail | yes | no |
| baseline price | yes, as a suggestion | none |
| unit conversion | full (density, grams-per-piece) | none |
| allowed usage units | any of g/kg/ml/l/tsp/tbsp/cup/each | **purchase unit, or "½ pack"** |

The unit restriction on free-text rows is deliberate. Without density or
per-piece data, "2 tbsp" against a price-per-kg cannot be converted, and the
engine would correctly return *unpriceable* — which reads as a bug to someone
who just typed a valid amount. Restricting the dropdown prevents the dead end
rather than explaining it.

### Prefill

When an ingredient is added, the purchase fields are filled from, in order:

1. The user's own price from `ingredient_prices` (theirs or their household's).
2. The researched baseline, shown greyed with its shop name and a tap-to-accept
   affordance. Not silently adopted — the row must say whose number it is.
3. Nothing, for free-text rows.

## 2. Data model

One new table. Same shape as `ingredient_prices`: `user_id`, a nullable
`household_id` owned by the existing `set_row_household()` trigger, and the
`using (user_id = auth.uid() or household_id = public.my_household_id())`
policy.

```sql
create table if not exists public.costings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  household_id uuid references public.households (id) on delete set null,
  name text not null check (char_length(name) between 1 and 120),
  servings int not null default 4 check (servings between 1 and 100),
  currency text not null check (currency ~ '^[A-Z]{3}$'),
  items jsonb not null default '[]'::jsonb,
  source_recipe_slug text check (source_recipe_slug is null
    or char_length(source_recipe_slug) between 1 and 200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Each `items` entry:

```ts
type CostingItem = {
  label: string                    // always present, what the row is called
  slug: string | null              // catalogue ingredient, or null for free text
  priceMinor: number | null        // what you paid
  packAmount: number | null        // for how much
  packUnit: 'g' | 'ml' | 'piece' | null
  useAmount: string | null         // free text: "1/2", "300" — parsed by parseQuantity
  useUnit: string | null
}
```

`packAmount` is a number and `useAmount` is a string, deliberately. A pack size
is read off a label and is always a plain number; a usage amount is how a recipe
is written and must accept "1/2" and "1½", which `parseQuantity` already
handles. Storing usage as a number would mean parsing at entry and losing what
the cook typed.

### Why JSONB rather than a child table

A costing's rows are only ever read and written as a whole — nothing queries
"all items across all costings". JSONB makes autosave a single atomic write
rather than a diff of inserts, updates and deletes, and removes an ordering
column. This differs from `meal_plan` and `collection_items`, which are
relational *because* individual rows are queried and mutated independently.

### Why each item carries its own price

A costing is a record of a purchase, not a live query. Saving "Dad's chilli" in
March and updating the mince price in June must leave March's costing showing
March's cost, or *"what did that dinner cost"* stops being answerable and a
one-off deal price silently rewrites history.

`currency` is snapshotted on the costing for the same reason.

## 3. Price book interaction

Editing a price on a row:

1. Updates that row immediately (the costing's own snapshot).
2. Upserts to `ingredient_prices`, with an inline *"saved to your prices ·
   undo"*.

Automatic-with-undo rather than an opt-in checkbox: the point of the price book
is that a correction outlives the sitting and reaches every recipe, and a
checkbox nobody finds defeats it. The snapshot makes this safe — undo affects
the book, never the costing.

Free-text rows have no `slug`, so nothing is saved to the book. The row says so.

## 4. Pages

| route | purpose |
|---|---|
| `/calculator` | saved costings, newest first, plus "New costing" |
| `/calculator/[id]` | the working calculator |

`/prices` redirects to `/calculator` via a permanent redirect in
`next.config.ts`. The route is `noindex` and days old, so no external links are
at risk — but three internal callers point at it and must move in the same
change, or the nav lands on a redirect at best and a 404 at worst:

- `src/components/HeaderNav.tsx` — the desktop "Calculator" entry
- `src/components/MobileNav.tsx` — the drawer entry
- `src/components/CostPanel.tsx` — "Use what you actually pay" on every recipe

Both are `robots: { index: false, follow: false }` and `dynamic = 'force-dynamic'`
— personal pages, following `/account`.

The ingredient catalogue and baseline prices are public and identical for
everyone, so they are fetched server-side. The user's prices and costings are
loaded in the browser, because RLS is what decides which rows they may see.

## 5. Signed-out behaviour

The calculator works fully without an account, backed by `localStorage` under
`palate:cost-calculator` — the key the current calculator already uses, kept
rather than renamed so anyone mid-list when this ships does not lose it. The
stored shape gains `name` and drops nothing, so an existing draft still loads. Only *saving a named costing* requires signing in, and
the prompt appears at that moment rather than on arrival.

On sign-in, an existing local draft is offered as the first saved costing.

## 6. The recipe bridge

Every recipe page gains **"Cost this yourself"** beside the cost panel. It
creates a costing with:

- `name` = the recipe title
- `servings` = the recipe's servings
- `source_recipe_slug` = the recipe slug
- one item per ingredient row, with usage prefilled from the recipe and purchase
  prefilled by the rules in §1

Heading rows and rows with no quantity are skipped — they cannot be costed and
would arrive as empty rows to delete.

## 7. Component structure

`CostCalculator.tsx` is already too large to reason about. It splits into:

- `useCosting(id)` — load, autosave (debounced), and the `computeCost` call.
  Owns all Supabase access.
- `CalculatorRow` — one row: purchase, usage, derived cost, remove.
- `IngredientPicker` — search over the catalogue, plus "add *X* as free text".
- `CostingTotals` — the sidebar: total, per plate, servings, currency.
- `CostingList` — the `/calculator` index.

Each is independently testable and none needs to know how the others fetch.

## 8. Failure modes

| case | behaviour |
|---|---|
| amount not yet typed | row shows `—`, not `£0.00`; excluded from coverage |
| price not known | row shows `?` with a reason on hover; total says it is short |
| usage unit unconvertible | row says so; never a guessed number |
| price in another currency | reported as a mismatch, never converted |
| Supabase unreachable | calculator works; saving surfaces an error and retries |
| `costings` table missing | list is empty, saving reports it — the site still builds and runs, as `ingredient_prices` already does |

## 9. Testing

- `tests/unit/cost.spec.ts` — extend for free-text rows (no ingredient data).
- `tests/unit/costCalculator.spec.tsx` — extend the existing component tests:
  purchase and usage both render, editing a price recomputes, free-text rows
  restrict their unit dropdown, removing a row updates the total.
- `tests/unit/costing.spec.ts` — new: serialise/deserialise `items`, and the
  localStorage draft round-trip.
- `tests/int/costings.int.spec.ts` — RLS: a user reads their own and their
  household's costings and nobody else's.

Existing counts to preserve: 466 unit tests currently pass.

## 10. Out of scope

Deliberately not in this build, in the order they were judged most valuable:

1. **Shopping vs cooking cost** — whole-pack shopping total, leftover value and
   second-time cost. Needs no new data; it is derived from purchase and usage,
   which every row already carries. This is the agreed next feature.
2. **Cost a whole week** — pool the meal plan's recipes, count shared items once.
3. **Feed N people on £X** — budget-first planning.
4. **Cost-rank the catalogue** — per-plate figures on cards, sort and filter.
