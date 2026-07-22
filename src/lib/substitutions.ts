/**
 * Groups an ingredient's curated substitutions for display: "Closest flavour /
 * Closest texture / Probably in your cupboard." A sub is either a catalog
 * ingredient (populated relationship → use its name) or free text. Rows with no
 * usable label are dropped; empty groups never render. Pure — a runtime read.
 */
export type SubKind = 'flavor' | 'texture' | 'cupboard'

export type SubRow = {
  sub?: { name?: string | null } | number | null
  subText?: string | null
  kind: SubKind
  ratio?: string | null
  note?: string | null
}

export type GroupedSub = { label: string; ratio?: string; note?: string }

const ORDER: Array<{ kind: SubKind; title: string }> = [
  { kind: 'flavor', title: 'Closest flavour' },
  { kind: 'texture', title: 'Closest texture' },
  { kind: 'cupboard', title: 'Probably in your cupboard' },
]

function labelOf(row: SubRow): string {
  if (row.sub && typeof row.sub === 'object' && row.sub.name) return row.sub.name
  return (row.subText ?? '').trim()
}

export function groupSubstitutions(
  rows: SubRow[] | null | undefined,
): Array<{ kind: SubKind; title: string; items: GroupedSub[] }> {
  if (!rows?.length) return []
  return ORDER.map(({ kind, title }) => {
    const items = rows
      .filter((r) => r.kind === kind)
      .map((r) => {
        const label = labelOf(r)
        if (!label) return null
        return {
          label,
          ...(r.ratio ? { ratio: r.ratio } : {}),
          ...(r.note ? { note: r.note } : {}),
        }
      })
      .filter((x): x is GroupedSub => x !== null)
    return { kind, title, items }
  }).filter((g) => g.items.length > 0)
}
