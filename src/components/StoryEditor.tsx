'use client'

import { useRef, useState, type ReactNode } from 'react'

import { MarkdownStory } from '@/components/MarkdownStory'
import { STORY_MARKDOWN_CAP } from '@/lib/recipeLimits'

/**
 * Markdown Story editor for the studio. A modern formatting toolbar (heading,
 * bold, italic, link, list, quote, image) inserts the right Markdown at the
 * cursor so creators never need to know the syntax, plus a live Preview using
 * the same renderer the recipe page uses. Uploaded image ids are tracked so
 * they stay associated with the recipe.
 */

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

const ICONS: Record<string, ReactNode> = {
  h2: <svg viewBox="0 0 24 24" width="17" height="17" {...stroke}><path d="M4 6v12M12 6v12M4 12h8" /><path d="M17 18c0-2 4-2.5 4-5 0-1.4-1.2-2.2-2.4-2-.9.1-1.6.8-1.6 1.6" /></svg>,
  h3: <svg viewBox="0 0 24 24" width="17" height="17" {...stroke}><path d="M4 6v12M11 6v12M4 12h7" /><path d="M15.5 8.5c.3-.7 1-1.2 2-1.2 1.2 0 2 .8 2 1.8s-.9 1.6-1.8 1.6c1.1 0 2 .7 2 1.8s-.9 1.9-2.2 1.9c-1 0-1.8-.5-2.1-1.2" /></svg>,
  bold: <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}><path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" /></svg>,
  italic: <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}><path d="M10 5h7M7 19h7M14 5l-4 14" /></svg>,
  link: <svg viewBox="0 0 24 24" width="16" height="16" {...stroke}><path d="M10 14a4 4 0 0 0 6 .5l2-2a4 4 0 0 0-6-6l-1 1" /><path d="M14 10a4 4 0 0 0-6-.5l-2 2a4 4 0 0 0 6 6l1-1" /></svg>,
  list: <svg viewBox="0 0 24 24" width="17" height="17" {...stroke}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>,
  quote: <svg viewBox="0 0 24 24" width="17" height="17" {...stroke}><path d="M6 7c-1.5 0-2.5 1.2-2.5 2.7 0 1.4 1 2.3 2.2 2.3 1.3 0 2-.9 1.8-2.4M15 7c-1.5 0-2.5 1.2-2.5 2.7 0 1.4 1 2.3 2.2 2.3 1.3 0 2-.9 1.8-2.4" /><path d="M7.7 9.5c0 3-1 4.6-3 5.7M16.7 9.5c0 3-1 4.6-3 5.7" /></svg>,
  image: <svg viewBox="0 0 24 24" width="17" height="17" {...stroke}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-5-9 9" /></svg>,
}

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
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const cap = (s: string) => s.slice(0, STORY_MARKDOWN_CAP)

  /** Wrap the current selection (or a placeholder) with before/after markers. */
  const surround = (before: string, after: string, placeholder: string) => {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart ?? value.length
    const end = ta.selectionEnd ?? value.length
    const sel = value.slice(start, end) || placeholder
    onChange(cap(value.slice(0, start) + before + sel + after + value.slice(end)))
    requestAnimationFrame(() => {
      ta.focus()
      const s = start + before.length
      ta.setSelectionRange(s, s + sel.length)
    })
  }

  /** Add a prefix at the start of the current line (headings, list, quote). */
  const linePrefix = (prefix: string) => {
    const ta = taRef.current
    if (!ta) return
    const start = ta.selectionStart ?? value.length
    const lineStart = value.lastIndexOf('\n', start - 1) + 1
    onChange(cap(value.slice(0, lineStart) + prefix + value.slice(lineStart)))
    requestAnimationFrame(() => {
      ta.focus()
      const pos = start + prefix.length
      ta.setSelectionRange(pos, pos)
    })
  }

  const insert = (snippet: string) => {
    const ta = taRef.current
    if (!ta) {
      onChange(cap(value + snippet))
      return
    }
    const start = ta.selectionStart ?? value.length
    const end = ta.selectionEnd ?? value.length
    onChange(cap(value.slice(0, start) + snippet + value.slice(end)))
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
      insert(`\n\n![](${data.url})\n\n`)
      if (typeof data.id === 'number') onImageIdsChange([...imageIds, data.id])
    } catch {
      setError('Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  /** Paste or drop an image straight into the story — uploaded, then written in
   *  as Markdown at the caret. The hero picker ignores pastes aimed at this
   *  textarea, so the two no longer fight over the clipboard. */
  const imageFromTransfer = (items: DataTransferItemList | null | undefined, files: FileList | null | undefined) => {
    const fromItems = [...(items ?? [])].find((it) => it.kind === 'file' && it.type.startsWith('image/'))
    if (fromItems) return fromItems.getAsFile()
    return [...(files ?? [])].find((f) => f.type.startsWith('image/')) ?? null
  }

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const file = imageFromTransfer(e.clipboardData?.items, e.clipboardData?.files)
    if (!file || uploading) return
    e.preventDefault()
    void upload(file)
  }

  const onDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    const file = imageFromTransfer(e.dataTransfer?.items, e.dataTransfer?.files)
    if (!file || uploading) return
    e.preventDefault()
    setDragOver(false)
    void upload(file)
  }

  const TOOLS: { key: string; title: string; run: () => void }[] = [
    { key: 'h2', title: 'Heading', run: () => linePrefix('## ') },
    { key: 'h3', title: 'Subheading', run: () => linePrefix('### ') },
    { key: 'bold', title: 'Bold', run: () => surround('**', '**', 'bold text') },
    { key: 'italic', title: 'Italic', run: () => surround('*', '*', 'italic text') },
    { key: 'link', title: 'Link', run: () => surround('[', '](https://)', 'link text') },
    { key: 'list', title: 'List', run: () => linePrefix('- ') },
    { key: 'quote', title: 'Quote', run: () => linePrefix('> ') },
  ]

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="eyebrow">Story (optional)</span>
        <button
          type="button"
          onClick={() => setPreview((p) => !p)}
          className="font-mono text-tag tracking-[0.1em] text-slate uppercase hover:text-flame"
        >
          {preview ? 'Edit' : 'Preview'}
        </button>
      </div>

      {!preview && (
        <div className="flex flex-wrap items-center gap-0.5 rounded-t border border-rule bg-wash/50 p-1">
          {TOOLS.map((t) => (
            <button
              key={t.key}
              type="button"
              title={t.title}
              aria-label={t.title}
              onClick={t.run}
              className="grid h-8 w-8 place-items-center rounded text-slate transition-colors hover:bg-card hover:text-flame"
            >
              {ICONS[t.key]}
            </button>
          ))}
          <span className="mx-1 h-5 w-px bg-rule" aria-hidden="true" />
          <label
            title="Insert image"
            aria-label="Insert image"
            className="grid h-8 w-8 cursor-pointer place-items-center rounded text-slate transition-colors hover:bg-card hover:text-flame"
          >
            {uploading ? <span className="font-mono text-[0.6rem]">…</span> : ICONS.image}
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
        </div>
      )}

      {preview ? (
        <div className="min-h-[8rem] rounded border border-rule bg-transparent px-3 py-2">
          {/* Contents stacked, not railed: the editor column is too narrow for a
              rail without cramping the prose below a readable measure. */}
          {value.trim() ? (
            <MarkdownStory markdown={value} contentsLayout="stacked" />
          ) : (
            <p className="m-0 text-eyebrow text-slate/60">Nothing to preview yet.</p>
          )}
        </div>
      ) : (
        <textarea
          ref={taRef}
          value={value}
          maxLength={STORY_MARKDOWN_CAP}
          rows={8}
          placeholder="Tell the story behind the dish. Use the buttons above to format, or write plain and it still looks great. Paste or drop a photo straight in."
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          onDrop={onDrop}
          onDragOver={(e) => {
            if ([...(e.dataTransfer?.items ?? [])].some((it) => it.kind === 'file')) {
              e.preventDefault()
              setDragOver(true)
            }
          }}
          onDragLeave={() => setDragOver(false)}
          className={`w-full resize-y rounded-b border border-t-0 bg-transparent px-3 py-2 font-mono text-eyebrow leading-relaxed text-ink placeholder:text-slate/50 focus:outline-none ${
            dragOver ? 'border-flame bg-flame/5' : 'border-rule focus:border-flame'
          }`}
        />
      )}

      <div className="flex items-center justify-between">
        <span className="font-mono text-tag text-slate">
          Replaces the instructions behind a toggle, so reading stays opt-in.
        </span>
        <span className="font-mono text-tag text-slate tabular-nums">
          {value.length}/{STORY_MARKDOWN_CAP}
        </span>
      </div>
      {error && (
        <span role="alert" className="font-mono text-caption text-heat">
          {error}
        </span>
      )}
    </div>
  )
}
