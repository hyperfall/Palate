'use client'

import { useRef, useState } from 'react'

import { MarkdownStory } from '@/components/MarkdownStory'
import { STORY_MARKDOWN_CAP } from '@/lib/recipeLimits'

/**
 * Markdown Story editor for the studio: a textarea with an image uploader that
 * inserts `![](url)` at the cursor (images upload immediately so the markdown
 * has a real URL), plus a live Preview using the same renderer the recipe page
 * uses. Uploaded image ids are tracked so they're associated with the recipe.
 */
export function StoryEditor({
  value,
  onChange,
  imageIds,
  onImageIdsChange,
}: {
  value: string
  onChange: (v: string) => void
  imageIds: number[]
  onImageIdsChange: (ids: number[]) => void
}) {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const [preview, setPreview] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const insertAtCursor = (snippet: string) => {
    const ta = taRef.current
    if (!ta) {
      onChange(`${value}${snippet}`)
      return
    }
    const start = ta.selectionStart ?? value.length
    const end = ta.selectionEnd ?? value.length
    const next = value.slice(0, start) + snippet + value.slice(end)
    onChange(next.slice(0, STORY_MARKDOWN_CAP))
    // Restore focus + caret after the inserted text.
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + snippet.length
      ta.setSelectionRange(pos, pos)
    })
  }

  const upload = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('image', file)
      const res = await fetch('/studio/story-image', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Upload failed.')
        return
      }
      insertAtCursor(`\n\n![](${data.url})\n\n`)
      if (typeof data.id === 'number') onImageIdsChange([...imageIds, data.id])
    } catch {
      setError('Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">Story (optional, Markdown)</span>
        <div className="flex items-center gap-3">
          <label className="cursor-pointer font-mono text-[0.6875rem] tracking-[0.1em] text-slate uppercase hover:text-flame">
            {uploading ? 'Uploading…' : '+ Image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void upload(f)
                e.target.value = ''
              }}
            />
          </label>
          <button
            type="button"
            onClick={() => setPreview((p) => !p)}
            className="font-mono text-[0.6875rem] tracking-[0.1em] text-slate uppercase hover:text-flame"
          >
            {preview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {preview ? (
        <div className="min-h-[8rem] rounded border border-rule bg-transparent px-3 py-2">
          {value.trim() ? (
            <MarkdownStory markdown={value} />
          ) : (
            <p className="m-0 text-[0.875rem] text-slate/60">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={taRef}
          value={value}
          maxLength={STORY_MARKDOWN_CAP}
          rows={8}
          placeholder={'Tell the story behind the dish. Markdown works:\n\n## A heading\n\nA paragraph, **bold**, a [link](https://…).\n\nUse + Image to drop a photo in.'}
          onChange={(e) => onChange(e.target.value)}
          className="w-full resize-y rounded border border-rule bg-transparent px-3 py-2 font-mono text-[0.875rem] leading-relaxed text-ink placeholder:text-slate/50 focus:border-flame focus:outline-none"
        />
      )}

      <div className="flex items-center justify-between">
        <span className="font-mono text-[0.6875rem] text-slate">
          Replaces the instructions behind a toggle — opt-in reading.
        </span>
        <span className="font-mono text-[0.6875rem] text-slate tabular-nums">
          {value.length}/{STORY_MARKDOWN_CAP}
        </span>
      </div>
      {error && <span className="font-mono text-[0.75rem] text-heat">{error}</span>}
    </div>
  )
}
