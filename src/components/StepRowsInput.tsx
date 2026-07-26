'use client'

import { useRef, useState } from 'react'

export type StepRow = { text: string; imageId: number | null; imageUrl: string | null }

export const emptyStepRow: StepRow = { text: '', imageId: null, imageUrl: null }

/**
 * Numbered method steps, each able to carry its own photo — the shot that
 * answers "does mine look right?". A photo can be browsed, dropped onto the
 * step, or pasted while writing it; pasting is scoped to the focused step, so it
 * never reaches for the hero picker. Uploads go through the same creator-authed
 * endpoint the Story editor uses and are stored by media id.
 */
export function StepRowsInput({
  value,
  onChange,
}: {
  value: StepRow[]
  onChange: (next: StepRow[]) => void
}) {
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState<number | null>(null)
  const textRefs = useRef<Array<HTMLTextAreaElement | null>>([])
  const fileRefs = useRef<Array<HTMLInputElement | null>>([])

  const setAt = (i: number, patch: Partial<StepRow>) => {
    const next = [...value]
    next[i] = { ...next[i], ...patch }
    onChange(next)
  }

  const addRow = (at: number) => {
    const next = [...value]
    next.splice(at, 0, { ...emptyStepRow })
    onChange(next)
    requestAnimationFrame(() => textRefs.current[at]?.focus())
  }

  const removeRow = (i: number) => {
    if (value.length <= 1) {
      onChange([{ ...emptyStepRow }])
      return
    }
    onChange(value.filter((_, idx) => idx !== i))
    requestAnimationFrame(() => textRefs.current[Math.max(0, i - 1)]?.focus())
  }

  const upload = async (i: number, file: File) => {
    setError(null)
    setBusy(i)
    try {
      const fd = new FormData()
      fd.append('image', file)
      fd.append('alt', `Step ${i + 1}`)
      const res = await fetch('/studio/story-image', { method: 'POST', body: fd })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.url) {
        setError(data.error ?? 'Upload failed.')
        return
      }
      setAt(i, { imageId: typeof data.id === 'number' ? data.id : null, imageUrl: data.url })
    } catch {
      setError('Upload failed.')
    } finally {
      setBusy(null)
    }
  }

  const imageFrom = (items: DataTransferItemList | null | undefined, files: FileList | null | undefined) => {
    const it = [...(items ?? [])].find((x) => x.kind === 'file' && x.type.startsWith('image/'))
    if (it) return it.getAsFile()
    return [...(files ?? [])].find((f) => f.type.startsWith('image/')) ?? null
  }

  // Enter adds the next step; Backspace on an empty one removes it — same
  // rhythm as the ingredient rows.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>, i: number) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      addRow(i + 1)
    } else if (e.key === 'Backspace' && !value[i].text && !value[i].imageId && value.length > 1) {
      e.preventDefault()
      removeRow(i)
    }
  }

  const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>, i: number) => {
    const file = imageFrom(e.clipboardData?.items, e.clipboardData?.files)
    if (!file || busy !== null) return
    e.preventDefault()
    void upload(i, file)
  }

  return (
    <div role="group" aria-label="Steps" className="grid gap-3">
      {value.map((row, i) => (
        <div
          key={i}
          onDragOver={(e) => {
            if ([...(e.dataTransfer?.items ?? [])].some((x) => x.kind === 'file')) {
              e.preventDefault()
              setDragOver(i)
            }
          }}
          onDragLeave={() => setDragOver((d) => (d === i ? null : d))}
          onDrop={(e) => {
            const file = imageFrom(e.dataTransfer?.items, e.dataTransfer?.files)
            setDragOver(null)
            if (!file || busy !== null) return
            e.preventDefault()
            void upload(i, file)
          }}
          className={`grid grid-cols-[2rem_1fr_auto] items-start gap-2 rounded border p-2 transition-colors ${
            dragOver === i ? 'border-flame bg-flame/5' : 'border-transparent'
          }`}
        >
          <span className="pt-2 text-center font-mono text-[0.8125rem] font-medium text-flame tabular-nums">
            {String(i + 1).padStart(2, '0')}
          </span>

          <textarea
            ref={(el) => {
              textRefs.current[i] = el
            }}
            value={row.text}
            rows={2}
            maxLength={1200}
            aria-label={`Step ${i + 1}`}
            placeholder={i === 0 ? 'Marinate the chicken in the gochujang for 20 minutes.' : 'then…'}
            onChange={(e) => setAt(i, { text: e.target.value })}
            onKeyDown={(e) => onKeyDown(e, i)}
            onPaste={(e) => onPaste(e, i)}
            className="min-w-0 resize-y rounded border border-rule bg-transparent px-3 py-2 font-body text-[1rem] leading-relaxed text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none"
          />

          <div className="grid justify-items-center gap-1">
            <input
              ref={(el) => {
                fileRefs.current[i] = el
              }}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) void upload(i, f)
                e.target.value = ''
              }}
            />
            {row.imageUrl ? (
              <button
                type="button"
                onClick={() => fileRefs.current[i]?.click()}
                title="Replace this step's photo"
                className="group relative h-16 w-16 overflow-hidden rounded border border-rule p-0"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
                <img src={row.imageUrl} alt="" className="h-full w-full object-cover" />
                <span className="absolute inset-0 grid place-items-center bg-pan-deep/60 font-mono text-[0.5625rem] tracking-[0.1em] text-milk uppercase opacity-0 transition-opacity group-hover:opacity-100">
                  Replace
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => fileRefs.current[i]?.click()}
                disabled={busy === i}
                title="Add a photo of this step — or drop / paste one here"
                className="grid h-16 w-16 place-items-center rounded border border-dashed border-rule bg-transparent font-mono text-[0.5625rem] tracking-[0.08em] text-slate uppercase transition-colors hover:border-flame hover:text-flame disabled:opacity-50"
              >
                {busy === i ? '…' : '+ photo'}
              </button>
            )}
            {row.imageUrl && (
              <button
                type="button"
                onClick={() => setAt(i, { imageId: null, imageUrl: null })}
                className="cursor-pointer border-none bg-transparent p-0 font-mono text-[0.5625rem] tracking-[0.08em] text-slate uppercase hover:text-heat"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      ))}

      {error && <p className="font-mono text-[0.75rem] text-heat">{error}</p>}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => addRow(value.length)}
          className="w-fit cursor-pointer border-none bg-transparent p-0 font-mono text-[0.75rem] font-medium tracking-[0.1em] text-flame uppercase underline-offset-4 hover:underline"
        >
          + Add step
        </button>
        <span className="font-mono text-[0.6875rem] text-slate">
          A photo per step is optional — drop or paste one onto a step.
        </span>
      </div>
    </div>
  )
}
