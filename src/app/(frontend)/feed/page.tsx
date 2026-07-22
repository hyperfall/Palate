import type { Metadata } from 'next'
import Link from 'next/link'

import type { Recipe } from '@/payload-types'
import { RecipeCard } from '@/components/RecipeCard'
import { getPayloadClient } from '@/lib/queries'
import { serverUser, supabaseServer } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Your feed',
  robots: { index: false, follow: false },
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
          <Link href="/account" className="btn-primary mt-6 inline-block">
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  const supabase = await supabaseServer()
  const { data: follows } = (await supabase?.from('follows').select('author_slug')) ?? { data: [] }
  const slugs = (follows ?? []).map((r) => r.author_slug as string)

  let recipes: Recipe[] = []
  if (slugs.length > 0) {
    const payload = await getPayloadClient()
    const authors = await payload.find({ collection: 'authors', where: { slug: { in: slugs } }, depth: 0, limit: 100 })
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

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[56ch]">
        <p className="eyebrow m-0">Your feed</p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">From creators you follow.</h1>
      </header>

      {recipes.length === 0 ? (
        <p className="mt-10 text-slate">
          You’re not following anyone yet — find a creator you like and hit follow.{' '}
          <Link href="/recipes" className="text-flame underline underline-offset-4">
            Browse recipes
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
