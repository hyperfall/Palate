'use client'

import { useState } from 'react'

import type { WeekShoppingList, WeekSnapshot } from '@/lib/mealPlan'
import { renderWeekCanvas } from '@/lib/weekCardCanvas'
import { renderWeekPdf } from '@/lib/weekCardPdf'

/**
 * Export controls for the shared week: Download image (PNG) and Download PDF,
 * both painted from one theme-aware <canvas> renderer that includes the card
 * and the shopping list, plus Copy link. No browser print, no html-to-image.
 */
export function WeekCardActions({ week, shopping }: { week: WeekSnapshot; shopping: WeekShoppingList }) {
  const [busy, setBusy] = useState<null | 'png' | 'pdf'>(null)
  const [failed, setFailed] = useState(false)
  const [copied, setCopied] = useState(false)

  const save = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = name
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const downloadImage = async () => {
    if (busy) return
    setBusy('png')
    setFailed(false)
    try {
      const canvas = await renderWeekCanvas({ week })
      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
      if (!blob) throw new Error('toBlob returned null')
      save(blob, 'my-week.png')
    } catch (err) {
      console.error('[week card] image export failed:', err)
      setFailed(true)
    } finally {
      setBusy(null)
    }
  }

  const downloadPdf = async () => {
    if (busy) return
    setBusy('pdf')
    setFailed(false)
    try {
      const blob = await renderWeekPdf({ week, shopping })
      save(blob, 'my-week.pdf')
    } catch (err) {
      console.error('[week card] pdf export failed:', err)
      setFailed(true)
    } finally {
      setBusy(null)
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
    <div className="mt-8 grid justify-items-center gap-2">
      <div className="flex flex-wrap items-center justify-center gap-3">
        <button type="button" onClick={() => void downloadImage()} disabled={busy !== null} className="chip disabled:opacity-50">
          {busy === 'png' ? 'Rendering…' : 'Download image'}
        </button>
        <button type="button" onClick={() => void downloadPdf()} disabled={busy !== null} className="chip disabled:opacity-50">
          {busy === 'pdf' ? 'Building…' : 'Download PDF'}
        </button>
        <button type="button" onClick={() => void copyLink()} className="chip">
          {copied ? 'Copied ✓' : 'Copy link'}
        </button>
      </div>
      {failed && (
        <p className="m-0 text-[0.8125rem] text-heat">Couldn’t generate that file — please try again.</p>
      )}
    </div>
  )
}
