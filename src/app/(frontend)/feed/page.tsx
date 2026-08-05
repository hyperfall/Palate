import type { Metadata } from 'next'
import Link from 'next/link'

import type { Author, Recipe } from '@/payload-types'
import { FollowButton } from '@/components/FollowButton'
import { RecipeCard } from '@/components/RecipeCard'
import { imageFrom } from '@/lib/media'
import { getPayloadClient } from '@/lib/queries'
import { serverUser, supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your feed',
  robots: { index: false, follow: false },
}

/** Avatar + name + handle, linking to the creator's page. */
function CreatorChip({ author }: { author: Author }) {
  const avatar = imageFrom(author.avatar)
  return (
    <Link href={`/creator/${author.handle ?? author.slug}`} className="group flex min-w-0 items-center gap-2.5 no-underline">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element -- small avatar
        <img src={avatar.url} alt="" className="h-9 w-9 shrink-0 rounded-full border border-rule object-cover" />
      ) : (
        <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-rule bg-wash font-display text-note text-ink">
          {author.name?.[0]?.toUpperCase() ?? '?'}
        </span>
      )}
      <span className="min-w-0">
        <span className="block truncate text-note font-semibold text-ink group-hover:text-flame">
          {author.name}
        </span>
        {author.handle && (
          <span className="block font-mono text-tag text-slate">@{author.handle}</span>
        )}
      </span>
    </Link>
  )
}

export default async function FeedPage() {
  const user = await serverUser()

  if (!user) {
    return (
      <div className="shell py-14">
        <div className="max-w-[46ch]">
          <p className="eyebrow m-0">Your feed</p>
          <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">The latest from creators you follow.</h1>
          <p className="mt-3 text-slate max-sm:hidden">Sign in and follow a few creators to build your feed.</p>
          <Link href="/account?next=/feed" className="btn-primary mt-6 inline-block">
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  const supabase = await supabaseServer()
  const { data: follows } = (await supabase?.from('follows').select('author_slug')) ?? { data: [] }
  const slugs = (follows ?? []).map((r) => r.author_slug as string)

  const payload = await getPayloadClient()
  let followed: Author[] = []
  let recipes: Recipe[] = []
  if (slugs.length > 0) {
    const authors = await payload.find({
      collection: 'authors',
      where: { slug: { in: slugs } },
      depth: 1,
      limit: 100,
    })
    followed = authors.docs
    const ids = authors.docs.map((a) => a.id)
    if (ids.length > 0) {
      const found = await payload.find({
        collection: 'recipes',
        where: { and: [{ status: { equals: 'published' } }, { author: { in: ids } }] },
        sort: '-publishedAt',
        depth: 1,
        limit: 36,
      })
      recipes = found.docs
    }
  }

  // Following nobody: suggest the creators actually cooking here right now —
  // drawn from recent published recipes, so every suggestion has something to
  // read the moment it's followed.
  let suggested: Author[] = []
  if (slugs.length === 0) {
    const recent = await payload.find({
      collection: 'recipes',
      where: { status: { equals: 'published' } },
      sort: '-publishedAt',
      depth: 2,
      limit: 24,
    })
    const seen = new Map<string, Author>()
    for (const r of recent.docs) {
      const a = r.author
      if (a && typeof a === 'object' && a.slug && !seen.has(a.slug)) seen.set(a.slug, a)
    }
    suggested = [...seen.values()].slice(0, 6)
  }

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[56ch]">
        <p className="eyebrow m-0">Your feed</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">From creators you follow.</h1>
      </header>

      {followed.length > 0 && (
        <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-3 border-y border-rule py-4">
          <span className="eyebrow">Following</span>
          {followed.map((a) => (
            <CreatorChip key={a.id} author={a} />
          ))}
        </div>
      )}

      {slugs.length === 0 ? (
        <div className="mt-10 max-w-[64rem]">
          <p className="m-0 text-slate">
            Follow a creator and their newest recipes land here the day they publish.
          </p>
          {suggested.length > 0 && (
            <div className="mt-8">
              <p className="eyebrow m-0">Cooking on Palate now</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {suggested
                  .filter((a) => a.slug)
                  .map((a) => (
                    <div key={a.id} className="ticket-card is-static flex items-center justify-between gap-3 p-4">
                      <CreatorChip author={a} />
                      <FollowButton authorSlug={a.slug as string} />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      ) : recipes.length === 0 ? (
        // Followed creators, no published recipes yet — a different truth from
        // "not following anyone", so it gets its own sentence.
        <p className="mt-10 max-w-[52ch] text-slate">
          The creators you follow haven’t published here yet. The moment they do, it lands on this
          page.{' '}
          <Link href="/recipes" className="text-flame underline underline-offset-4">
            Browse the board meanwhile
          </Link>
          .
        </p>
      ) : (
        <div className="mt-10 grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.id} recipe={recipe} />
          ))}
        </div>
      )}
    </div>
  )
}
