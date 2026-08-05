import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { RecipeCard } from '@/components/RecipeCard'
import { COLLECTIONS, findCollection } from '@/lib/collections'
import { parseFilters } from '@/lib/filters'
import { findRecipes } from '@/lib/queries'
import { absoluteUrl } from '@/lib/site'

export const revalidate = 3600

export function generateStaticParams() {
  return COLLECTIONS.map((c) => ({ slug: c.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const collection = findCollection(slug)
  if (!collection) return {}
  return {
    title: collection.title,
    description: collection.blurb,
    alternates: { canonical: absoluteUrl(`/browse/${collection.slug}`) },
  }
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const collection = findCollection(slug)
  if (!collection) notFound()

  const filters = parseFilters(collection.params)
  const { recipes, totalDocs } = await findRecipes(filters, { limit: 24 })

  return (
    <div className="shell py-10 lg:py-14">
      <header className="max-w-[56ch]">
        <p className="eyebrow m-0">
          <Link href="/browse" className="text-flame no-underline hover:underline">
            Collections
          </Link>
        </p>
        <h1 className="mt-1 text-[clamp(1.5rem,4.5vw,2.75rem)]">{collection.title}</h1>
        <p className="mt-3 text-slate">
          {collection.blurb} <span className="text-slate/70">· {totalDocs} recipes</span>
        </p>
      </header>

      {recipes.length === 0 ? (
        <p className="mt-10 text-slate">
          Nothing here yet. Check back as the board fills up, or{' '}
          <Link href="/recipes" className="text-flame underline underline-offset-4">
            browse everything
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
