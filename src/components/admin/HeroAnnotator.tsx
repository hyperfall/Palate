'use client'

import { useEffect, useState } from 'react'
import { useForm, useFormFields } from '@payloadcms/ui'

type Pin = { i: number; x: number; y: number; kicker: string }

/**
 * Studio annotator: shows the recipe's hero photo and lets an editor place the
 * mise-en-place pins visually — select a pin, click the photo, it moves there.
 * Add / remove / label the pins in the native list below; this only writes the
 * x/y of existing rows (via dispatchFields), so it never fights Payload's array
 * row storage. Rendered by a `ui` field, so it holds no data of its own.
 */
export function HeroAnnotator() {
  const { dispatchFields } = useForm()
  const [imgUrl, setImgUrl] = useState<string | null>(null)
  const [selected, setSelected] = useState<number | null>(null)

  const heroImageId = useFormFields(([fields]) => fields?.heroImage?.value as string | number | undefined)

  const pins = useFormFields(([fields]) => {
    const rows = (fields?.heroAnnotations as { rows?: unknown[] } | undefined)?.rows ?? []
    return rows.map((_, i): Pin => ({
      i,
      x: Number(fields[`heroAnnotations.${i}.x`]?.value ?? 50),
      y: Number(fields[`heroAnnotations.${i}.y`]?.value ?? 50),
      kicker: String(fields[`heroAnnotations.${i}.kicker`]?.value ?? `Pin ${i + 1}`),
    }))
  })

  useEffect(() => {
    let live = true
    if (heroImageId == null || heroImageId === '') {
      setImgUrl(null)
      return
    }
    fetch(`/api/media/${heroImageId}?depth=0`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (live) setImgUrl(d?.sizes?.card?.url ?? d?.sizes?.hero?.url ?? d?.url ?? null)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [heroImageId])

  // Keep the selection valid if rows are removed.
  useEffect(() => {
    if (selected != null && selected >= pins.length) setSelected(null)
  }, [pins.length, selected])

  const placeAt = (e: React.MouseEvent<HTMLDivElement>) => {
    if (selected == null) return
    const r = e.currentTarget.getBoundingClientRect()
    const x = Math.min(100, Math.max(0, Math.round(((e.clientX - r.left) / r.width) * 100)))
    const y = Math.min(100, Math.max(0, Math.round(((e.clientY - r.top) / r.height) * 100)))
    dispatchFields({ type: 'UPDATE', path: `heroAnnotations.${selected}.x`, value: x })
    dispatchFields({ type: 'UPDATE', path: `heroAnnotations.${selected}.y`, value: y })
  }

  const label = { fontSize: 12, color: 'var(--theme-elevation-500)', margin: '0 0 8px' } as const

  if (!imgUrl) {
    return (
      <div style={{ marginBottom: 16 }}>
        <p style={label}>Hero annotations</p>
        <p style={{ fontSize: 13, color: 'var(--theme-elevation-400)' }}>
          Add a hero image above to place pins on it.
        </p>
      </div>
    )
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <p style={label}>
        {selected == null
          ? 'Select a pin below the photo, then click the photo to place it.'
          : `Placing “${pins[selected]?.kicker}” — click the photo. Click another pin to switch.`}
      </p>
      <div
        onClick={placeAt}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 640,
          aspectRatio: '16 / 10',
          borderRadius: 6,
          overflow: 'hidden',
          border: '1px solid var(--theme-elevation-150)',
          cursor: selected == null ? 'default' : 'crosshair',
          userSelect: 'none',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- admin-only preview */}
        <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        {pins.map((p) => {
          const isSel = p.i === selected
          return (
            <button
              key={p.i}
              type="button"
              title={p.kicker}
              onClick={(e) => {
                e.stopPropagation()
                setSelected(isSel ? null : p.i)
              }}
              style={{
                position: 'absolute',
                left: `${p.x}%`,
                top: `${p.y}%`,
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: 0,
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: '50%',
                  background: '#e4572e',
                  boxShadow: isSel ? '0 0 0 4px rgba(228,87,46,0.35)' : '0 0 0 2px rgba(255,255,255,0.9)',
                  outline: isSel ? '2px solid #fff' : 'none',
                }}
              />
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#fff',
                  background: 'rgba(20,16,12,0.75)',
                  padding: '1px 6px',
                  borderRadius: 3,
                  whiteSpace: 'nowrap',
                }}
              >
                {p.kicker}
              </span>
            </button>
          )
        })}
      </div>
      <p style={{ fontSize: 12, color: 'var(--theme-elevation-400)', margin: '8px 0 0' }}>
        {pins.length} pin{pins.length === 1 ? '' : 's'}. Add, remove, and label them in the list below.
      </p>
    </div>
  )
}
