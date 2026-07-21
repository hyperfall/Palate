'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { supabaseBrowser, type Collection, type SavedItem } from '@/lib/supabase/client'

/**
 * The saved-recipes board: every collection the user has named, plus an
 * "Everything saved" rail across all of them. All reads/writes go straight
 * from the browser to Supabase under row-level security — the Palate server
 * never sees account data.
 */
export function CollectionsBoard() {
  const supabase = supabaseBrowser()
  const [checked, setChecked] = useState(false)
  const [signedIn, setSignedIn] = useState(false)
  const [collections, setCollections] = useState<Collection[]>([])
  const [items, setItems] = useState<SavedItem[]>([])

  const load = async () => {
    if (!supabase) return
    try {
      const [cols, its] = await Promise.all([
        supabase.from('collections').select('id,name,created_at').order('created_at'),
        supabase
          .from('collection_items')
          .select('id,collection_id,recipe_slug,recipe_title,recipe_image,created_at')
          .order('created_at', { ascending: false }),
      ])
      setCollections((cols.data as Collection[]) ?? [])
      setItems((its.data as SavedItem[]) ?? [])
    } catch {
      // A network hiccup leaves the shelf empty rather than crashing the page.
    }
  }

  useEffect(() => {
    if (!supabase) {
      setChecked(true)
      return
    }
    supabase.auth
      .getUser()
      .then(({ data }) => {
        setSignedIn(Boolean(data.user))
        if (data.user) void load()
      })
      // Without this, a failed check would leave `checked` false forever and
      // the board would render nothing at all.
      .catch(() => setSignedIn(false))
      .finally(() => setChecked(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  if (!checked) return null

  if (!supabase || !signedIn) {
    return (
      <div className="ticket-card max-w-[34rem] p-6">
        <p className="eyebrow m-0 text-flame">Nothing on the shelf yet</p>
        <p className="mt-2 text-[0.9375rem] leading-relaxed text-slate">
          Sign in and every recipe you save — into collections you name yourself — lands here.
        </p>
        <Link href="/account" className="btn-primary mt-5">
          Sign in →
        </Link>
      </div>
    )
  }

  const removeItem = async (item: SavedItem) => {
    const { error } = await supabase.from('collection_items').delete().eq('id', item.id)
    // Only drop it from the shelf once the delete actually lands — otherwise a
    // blocked or failed request leaves the UI claiming it's gone when it isn't.
    if (!error) setItems((prev) => prev.filter((i) => i.id !== item.id))
  }

  const removeCollection = async (collection: Collection) => {
    const { error } = await supabase.from('collections').delete().eq('id', collection.id)
    if (!error) {
      setCollections((prev) => prev.filter((c) => c.id !== collection.id))
      setItems((prev) => prev.filter((i) => i.collection_id !== collection.id))
    }
  }

  // "Everything saved": deduped by recipe across collections, newest first.
  const everything = [...new Map(items.map((item) => [item.recipe_slug, item])).values()]

  const Card = ({ item, onRemove }: { item: SavedItem; onRemove?: () => void }) => (
    <div className="ticket-card group relative">
      <Link href={`/recipes/${item.recipe_slug}`} className="block p-3 no-underline">
        {item.recipe_image ? (
          // eslint-disable-next-line @next/next/no-img-element -- snapshot URL from Supabase
          <img
            src={item.recipe_image}
            alt=""
            width={320}
            height={200}
            className="aspect-[8/5] w-full rounded-sm object-cover"
          />
        ) : (
          <div aria-hidden="true" className="aspect-[8/5] w-full rounded-sm bg-wash" />
        )}
        <span className="mt-2.5 block font-display text-[1.0625rem] leading-snug text-ink">
          {item.recipe_title}
        </span>
      </Link>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${item.recipe_title}`}
          className="absolute top-2 right-2 hidden h-7 w-7 cursor-pointer place-items-center rounded border border-rule bg-card font-mono text-[0.8125rem] text-slate group-hover:grid hover:border-heat hover:text-heat"
        >
          ✕
        </button>
      )}
    </div>
  )

  return (
    <div className="grid gap-12">
      {everything.length === 0 ? (
        <div className="ticket-card max-w-[34rem] p-6">
          <p className="eyebrow m-0">Empty shelf</p>
          <p className="mt-2 text-[0.9375rem] text-slate">
            Open any recipe and hit <span className="font-mono">+ Save</span> — your collections
            build from there.
          </p>
          <Link href="/recipes" className="btn-primary mt-5">
            Browse the board →
          </Link>
        </div>
      ) : (
        <section>
          <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-2">
            <h2 className="text-[1.5rem]">Everything saved</h2>
            <span className="datum">{everything.length}</span>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-4">
            {everything.map((item) => (
              <Card key={item.recipe_slug} item={item} />
            ))}
          </div>
        </section>
      )}

      {collections.map((collection) => {
        const collectionItems = items.filter((i) => i.collection_id === collection.id)
        return (
          <section key={collection.id}>
            <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-2">
              <h2 className="text-[1.25rem]">{collection.name}</h2>
              <div className="flex items-baseline gap-4">
                <span className="datum">{collectionItems.length}</span>
                <button
                  type="button"
                  onClick={() => void removeCollection(collection)}
                  className="cursor-pointer border-none bg-transparent p-0 font-mono text-[0.8125rem] tracking-[0.1em] text-slate uppercase underline-offset-4 hover:text-heat hover:underline"
                >
                  Delete
                </button>
              </div>
            </div>
            {collectionItems.length === 0 ? (
              <p className="mt-4 text-[0.875rem] text-slate">Nothing in here yet.</p>
            ) : (
              <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-4">
                {collectionItems.map((item) => (
                  <Card key={item.id} item={item} onRemove={() => void removeItem(item)} />
                ))}
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
