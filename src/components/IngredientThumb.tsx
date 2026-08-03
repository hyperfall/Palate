import Image from 'next/image'

/**
 * A picture of an ingredient, or an honest stand-in for one.
 *
 * Nothing in the catalogue has a photograph yet — the admin can upload them one
 * at a time, and until then this draws a tinted tile keyed to what kind of
 * thing the ingredient is. That is deliberately not a grey box: a shopping list
 * or a cost breakdown is scanned rather than read, and a produce row that looks
 * different from a spice row is findable at a glance even before anyone has
 * taken a single photo.
 *
 * The glyphs are drawn rather than emoji. Emoji render differently on every
 * platform, carry their own colour that fights the palette, and pick fights
 * with a dark theme; a stroked path inherits currentColor and behaves.
 */

export type ThumbImage = { url: string; alt?: string | null } | null

/** The catalogue's own categories, each with a tint and a mark. */
const LOOK: Record<string, { tint: string; ink: string; path: React.ReactNode }> = {
  produce: {
    tint: 'bg-[color-mix(in_oklab,var(--color-effort)_16%,transparent)]',
    ink: 'text-effort',
    // A leaf on a stem.
    path: (
      <>
        <path d="M12 21c0-6 3-10 8-12-1 7-4 11-8 12z" />
        <path d="M12 21c0-5-2.5-8.5-7-10 1 6 3.5 9 7 10z" />
      </>
    ),
  },
  protein: {
    tint: 'bg-[color-mix(in_oklab,var(--color-flame)_14%,transparent)]',
    ink: 'text-flame',
    // A cut of meat with a bone.
    path: (
      <>
        <path d="M5 14a5 5 0 0 1 5-5h5a4 4 0 0 1 0 8h-5a5 5 0 0 1-5-3z" />
        <path d="M17 11.5v4" />
      </>
    ),
  },
  dairy: {
    tint: 'bg-[color-mix(in_oklab,var(--color-ink)_10%,transparent)]',
    ink: 'text-slate',
    // A milk carton.
    path: (
      <>
        <path d="M7 9h10v11H7z" />
        <path d="M7 9l2.5-4h5L17 9" />
      </>
    ),
  },
  'oil-fat': {
    tint: 'bg-[color-mix(in_oklab,var(--color-sweetness)_20%,transparent)]',
    ink: 'text-sweetness',
    // A bottle with a drop.
    path: (
      <>
        <path d="M10 4h4v3l2 3v10H8V10l2-3z" />
        <path d="M12 13c1 1.2 1.5 2 1.5 2.6a1.5 1.5 0 0 1-3 0c0-.6.5-1.4 1.5-2.6z" />
      </>
    ),
  },
  'grain-legume': {
    tint: 'bg-[color-mix(in_oklab,var(--color-sweetness)_16%,transparent)]',
    ink: 'text-slate',
    // An ear of grain.
    path: (
      <>
        <path d="M12 20V8" />
        <path d="M12 12c0-2 1.5-3.5 3.5-4 0 2-1.5 3.5-3.5 4z" />
        <path d="M12 12c0-2-1.5-3.5-3.5-4 0 2 1.5 3.5 3.5 4z" />
        <path d="M12 8c0-2 1.5-3.5 3.5-4 0 2-1.5 3.5-3.5 4z" />
        <path d="M12 8c0-2-1.5-3.5-3.5-4 0 2 1.5 3.5 3.5 4z" />
      </>
    ),
  },
  'spice-herb': {
    tint: 'bg-[color-mix(in_oklab,var(--color-heat)_14%,transparent)]',
    ink: 'text-heat',
    // A spice jar.
    path: (
      <>
        <path d="M8 10h8v10H8z" />
        <path d="M9.5 10V7h5v3" />
        <path d="M11 4.5h2" />
      </>
    ),
  },
  condiment: {
    tint: 'bg-[color-mix(in_oklab,var(--color-flame)_10%,transparent)]',
    ink: 'text-slate',
    // A tin.
    path: (
      <>
        <ellipse cx="12" cy="7" rx="5" ry="2.2" />
        <path d="M7 7v10c0 1.2 2.2 2.2 5 2.2s5-1 5-2.2V7" />
      </>
    ),
  },
  bakery: {
    tint: 'bg-[color-mix(in_oklab,var(--color-sweetness)_18%,transparent)]',
    ink: 'text-sweetness',
    path: (
      <>
        <path d="M5 13a7 4.5 0 0 1 14 0v4a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
        <path d="M9 13v6M15 13v6" />
      </>
    ),
  },
}

const FALLBACK = {
  tint: 'bg-[color-mix(in_oklab,var(--color-ink)_8%,transparent)]',
  ink: 'text-slate',
  // A plain bowl, for anything uncategorised.
  path: (
    <>
      <path d="M4 11h16a8 8 0 0 1-8 8 8 8 0 0 1-8-8z" />
      <path d="M12 11V6" />
    </>
  ),
}

export function IngredientThumb({
  name,
  category,
  image,
  size = 44,
}: {
  name: string
  category?: string | null
  image?: ThumbImage
  size?: number
}) {
  if (image?.url) {
    return (
      <Image
        src={image.url}
        alt={image.alt || name}
        width={size}
        height={size}
        className="shrink-0 rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    )
  }

  const look = (category && LOOK[category]) || FALLBACK
  return (
    <div
      // Decorative: the ingredient's name is always beside it, so announcing a
      // stand-in tile would just say everything twice.
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-md ${look.tint} ${look.ink}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 24 24"
        width={Math.round(size * 0.55)}
        height={Math.round(size * 0.55)}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {look.path}
      </svg>
    </div>
  )
}
