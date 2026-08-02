import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { FollowButton } from '@/components/FollowButton'
import { SocialLinks } from '@/components/SocialIcons'

import { RecipeCard } from '@/components/RecipeCard'
import { imageFrom } from '@/lib/media'
import { findAuthorByHandle, findAuthorsWithHandles, findRecipesByAuthor } from '@/lib/queries'
import { absoluteUrl } from '@/lib/site'
import { cleanSocials } from '@/lib/socials'

export const revalidate = 3600 // ISR — new recipes join a creator's grid hourly.

/** A visitor might type /creator/@name or /creator/name; both resolve the same. */
function normalizeHandle(raw: string): string {
  return decodeURIComponent(raw).replace(/^@+/, '').trim().toLowerCase()
}

export async function generateStaticParams() {
  const authors = await findAuthorsWithHandles()
  return authors.map((author) => ({ handle: author.handle as string }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>
}): Promise<Metadata> {
  const { handle } = await params
  const author = await findAuthorByHandle(normalizeHandle(handle))
  if (!author) return {}

  const canonical = absoluteUrl(`/creator/${author.handle}`)
  const description = author.bio ?? `Recipes by ${author.name} on Palate.`
  // Default limit, matching the page body's call, so React cache serves both
  // from one query instead of issuing a second just to read the count.
  const { totalDocs } = await findRecipesByAuthor(author.id)
  const avatar = imageFrom(author.avatar)

  return {
    title: `${author.name} (@${author.handle})`,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${author.name} — recipes on Palate`,
      description,
      url: canonical,
      type: 'profile',
      ...(avatar ? { images: [{ url: avatar.url }] } : {}),
    },
    // A creator with nothing published yet is thin content — keep it unindexed
    // until their first recipe lands.
    ...(totalDocs === 0 ? { robots: { index: false, follow: true } } : {}),
  }
}

/** The creator profile — a station fronted by a person, not a country. */
export default async function CreatorPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const author = await findAuthorByHandle(normalizeHandle(handle))
  if (!author) notFound()

  const { recipes, totalDocs } = await findRecipesByAuthor(author.id)
  const avatar = imageFrom(author.avatar)

  return (
    <div>
      {/* The creator's card at the pass — avatar, name, handle, their line. */}
      <header className="bg-pan text-milk">
        <div className="shell py-12">
          <p className="eyebrow m-0 text-flame">
            Creator · {totalDocs} {totalDocs === 1 ? 'recipe' : 'recipes'}
          </p>

          <div className="mt-4 flex items-center gap-5">
            {avatar ? (
              <Image
                src={avatar.url}
                alt={author.name}
                width={72}
                height={72}
                className="h-[4.5rem] w-[4.5rem] rounded-full border border-pan-line object-cover"
              />
            ) : (
              <span
                aria-hidden="true"
                className="grid h-[4.5rem] w-[4.5rem] place-items-center rounded-full border border-pan-line bg-pan-deep font-display text-3xl text-milk"
              >
                {author.name[0]?.toUpperCase()}
              </span>
            )}

            <div className="min-w-0">
              <h1 className="flex flex-wrap items-center gap-2.5 text-[clamp(2rem,4vw,3.25rem)] text-milk">
                {author.name}
                {author.verified && (
                  <span
                    title="Verified creator"
                    className="grid h-6 w-6 place-items-center rounded-full bg-flame text-sm text-paper"
                  >
                    ✓
                  </span>
                )}
              </h1>
              <p className="mt-1 font-mono text-note text-milk/70">@{author.handle}</p>
            </div>
          </div>

          {author.bio && (
            <p className="mt-6 max-w-[60ch] text-lg leading-relaxed text-milk/80">{author.bio}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-4">
            <FollowButton authorSlug={author.slug} tone="pan" />
            <SocialLinks socials={cleanSocials((author.socials as Record<string, unknown>) ?? null)} className="text-milk/70" />
          </div>
        </div>
      </header>

      <section className="shell py-10">
        {recipes.length === 0 ? (
          <div className="ticket-card max-w-[38rem] p-6">
            <p className="eyebrow m-0 text-flame">Nothing on the pass yet</p>
            <p className="mt-2 text-slate">
              {author.name} hasn’t published a recipe here yet. Check back — or browse the board in
              the meantime.
            </p>
            <Link href="/recipes" className="btn-primary mt-5">
              Browse the board →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 min-[100rem]:grid-cols-4">
            {recipes.map((recipe) => (
              <RecipeCard key={recipe.id} recipe={recipe} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
