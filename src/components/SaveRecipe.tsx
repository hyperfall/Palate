'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { supabaseBrowser, type Collection } from '@/lib/supabase/client'
import { signInHref } from '@/lib/signInRedirect'

/**
 * Save-to-collection, on the recipe hero. Signed out (or unconfigured), the
 * button routes to /account. Signed in, it opens a small panel: tap a
 * collection to toggle this recipe in or out of it, or name a new one. The
 * button reads "Saved" the moment the recipe lives in any collection.
 */
export function SaveRecipe({
  slug,
  title,
  image,
}: {
  slug: string
  title: string
  image: string | null
}) {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [signedIn, setSignedIn] = useState<boolean | null>(null)
  const [collections, setCollections] = useState<Collection[]>([])
  const [memberOf, setMemberOf] = useState<Set<string>>(new Set())
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!supabase) return
    supabase.auth
      .getUser()
      .then(({ data }) => setSignedIn(Boolean(data.user)))
      // Unknown reads as signed-out — the button falls back to the /account
      // link instead of getting stuck unclickable.
      .catch(() => setSignedIn(false))
  }, [supabase])

  const load = async () => {
    if (!supabase) return
    try {
      const [cols, items] = await Promise.all([
        supabase.from('collections').select('id,name,created_at').order('created_at'),
        supabase.from('collection_items').select('collection_id').eq('recipe_slug', slug),
      ])
      setCollections((cols.data as Collection[]) ?? [])
      setMemberOf(new Set((items.data ?? []).map((r: { collection_id: string }) => r.collection_id)))
    } catch {
      // A network hiccup shows an empty panel rather than throwing.
    }
  }

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [])

  const toggle = async (collectionId: string) => {
    if (!supabase || busy) return
    setBusy(true)
    setError(null)
    try {
      if (memberOf.has(collectionId)) {
        const { error } = await supabase
          .from('collection_items')
          .delete()
          .eq('collection_id', collectionId)
          .eq('recipe_slug', slug)
        // Only flip the check mark once the write actually succeeded — a
        // silent failure here would tell someone a recipe is saved when it
        // isn't.
        if (error) setError('Couldn’t update. Try again.')
        else {
          setMemberOf((prev) => {
            const next = new Set(prev)
            next.delete(collectionId)
            return next
          })
        }
      } else {
        const { error } = await supabase.from('collection_items').insert({
          collection_id: collectionId,
          recipe_slug: slug,
          recipe_title: title,
          recipe_image: image,
        })
        if (error) setError('Couldn’t save. Try again.')
        else setMemberOf((prev) => new Set(prev).add(collectionId))
      }
    } catch {
      setError('Couldn’t save. Check your connection.')
    } finally {
      setBusy(false)
    }
  }

  const createAndSave = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!supabase || !newName.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const { data, error } = await supabase
        .from('collections')
        .insert({ name: newName.trim() })
        .select('id,name,created_at')
        .single()
      if (error || !data) {
        setError('Couldn’t create that collection. Try again.')
      } else {
        setCollections((prev) => [...prev, data as Collection])
        setNewName('')
        await toggle((data as Collection).id)
      }
    } finally {
      setBusy(false)
    }
  }

  const saved = memberOf.size > 0

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (!supabase || signedIn === false) {
            router.push(signInHref())
            return
          }
          const willOpen = !open
          setOpen(willOpen)
          if (willOpen) void load()
        }}
        className="chip !border-milk/40 !text-milk hover:!border-flame"
        data-active={saved}
        aria-expanded={open}
        // Signed out, the label says what the click does. Without this it read
        // "+ Save" and then yanked the reader to a bare sign-in page with no
        // word of why — the same complaint signInHref's own comment records,
        // fixed there only for the return trip. This is PantryToggle's pattern.
        title={signedIn === false ? 'Sign in to save this recipe' : undefined}
      >
        {signedIn === false ? 'Sign in to save' : saved ? '✓ Saved' : '+ Save'}
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-2 w-[19rem] rounded-md border border-ink/30 bg-card p-4 text-ink shadow-(--shadow-block)">
          <p className="eyebrow m-0">Save to</p>
          {error && (
            <p role="alert" className="mt-1 mb-0 font-mono text-tag text-heat">
              {error}
            </p>
          )}

          {collections.length > 0 ? (
            <ul className="m-0 mt-2 grid list-none gap-1 p-0">
              {collections.map((collection) => (
                <li key={collection.id}>
                  <button
                    type="button"
                    onClick={() => void toggle(collection.id)}
                    disabled={busy}
                    className="flex w-full cursor-pointer items-center justify-between gap-3 rounded border-none bg-transparent px-2 py-1.5 text-left font-mono text-detail font-medium text-ink hover:bg-wash"
                  >
                    <span className="truncate">{collection.name}</span>
                    <span className={memberOf.has(collection.id) ? 'text-flame' : 'text-rule'}>
                      {memberOf.has(collection.id) ? '✓' : '+'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 mb-0 text-detail text-slate">
              No collections yet. Name your first one.
            </p>
          )}

          <form onSubmit={createAndSave} className="mt-3 flex gap-2 border-t border-rule pt-3">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Weeknight bangers"
              maxLength={60}
              className="min-w-0 flex-1 rounded border border-rule bg-transparent px-2.5 py-1.5 font-mono text-detail text-ink focus:border-flame focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy || !newName.trim()}
              className="chip disabled:opacity-50"
            >
              Create
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
