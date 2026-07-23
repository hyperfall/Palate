'use client'

import { useState } from 'react'

/**
 * Export controls for the week card: Save as PDF (browser print, isolated by
 * the `@media print` rule), Download image (PNG via html-to-image on the
 * `.week-card` node), and Copy link. Marked `.no-print` so it never appears in
 * the exported artifact.
 */
export function WeekCardActions() {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  const downloadImage = async () => {
    const el = document.querySelector<HTMLElement>('.week-card')
    if (!el || busy) return
    setBusy(true)
    setFailed(false)
    try {
      const { toPng } = await import('html-to-image')
      // Fonts (next/font, same-origin) and photos (same-origin) embed fine.
      // Guarded by a timeout so a browser that can't rasterize the SVG never
      // leaves the button stuck — the user can fall back to Save as PDF.
      const dataUrl = await Promise.race([
        toPng(el, { pixelRatio: 2, backgroundColor: '#ffffff' }),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timed out')), 25_000)),
      ])
      const a = document.createElement('a')
      a.href = dataUrl
      a.download = 'my-week.png'
      a.click()
    } catch (err) {
      console.error('[week card] image export failed:', err)
      setFailed(true)
    } finally {
      setBusy(false)
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard?.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked — no-op */
    }
  }

  return (
    <div className="no-print mt-6 grid justify-items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={() => window.print()} className="chip">
          Save as PDF
        </button>
        <button type="button" onClick={() => void downloadImage()} disabled={busy} className="chip disabled:opacity-50">
          {busy ? 'Rendering…' : 'Download image'}
        </button>
        <button type="button" onClick={() => void copyLink()} className="chip">
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
      </div>
      {failed && (
        <p className="m-0 text-[0.8125rem] text-heat">
          Couldn’t render the image here — try “Save as PDF”.
        </p>
      )}
    </div>
  )
}
