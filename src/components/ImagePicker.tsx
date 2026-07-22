'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * The picture control the Studio deserves: browse, drag-and-drop, and paste
 * straight from the clipboard, then a pan/zoom crop locked to the aspect the
 * site actually renders. No dependencies — pointer events in, canvas out.
 * Emits a cropped JPEG File; parents never see the raw original.
 */

type Props = {
  aspect: number // width / height, e.g. 4/3 for cards, 1 for avatars
  round?: boolean // circular mask preview (avatars)
  onCropped: (file: File, previewUrl: string) => void
  onClear?: () => void
  /** Listen for window-level paste while mounted. */
  acceptPaste?: boolean
  compact?: boolean
}

const OUT_WIDTH = 1600 // longest useful edge for the media pipeline

export function ImagePicker({ aspect, round, onCropped, onClear, acceptPaste = true, compact }: Props) {
  const [rawUrl, setRawUrl] = useState<string | null>(null)
  const [doneUrl, setDoneUrl] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragOver, setDragOver] = useState(false)
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null)

  const frameRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const pointer = useRef<{ x: number; y: number } | null>(null)

  const takeFile = useCallback((file: File | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    setRawUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setDoneUrl(null)
    setDims(null)
    setZoom(1)
    setOffset({ x: 0, y: 0 })
  }, [])

  // Paste anywhere on the page while this picker is mounted and un-cropped.
  useEffect(() => {
    if (!acceptPaste) return
    const onPaste = (event: ClipboardEvent) => {
      const item = [...(event.clipboardData?.items ?? [])].find((i) => i.type.startsWith('image/'))
      if (item) {
        event.preventDefault()
        takeFile(item.getAsFile())
      }
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
  }, [acceptPaste, takeFile])

  useEffect(
    () => () => {
      if (rawUrl) URL.revokeObjectURL(rawUrl)
    },
    [rawUrl],
  )

  // Same for the cropped blob: revoke it when it's replaced (re-crop / clear) or
  // when the picker unmounts (the pickerKey bump after a submit), so cropped
  // photos don't leak across a session of uploads.
  useEffect(
    () => () => {
      if (doneUrl) URL.revokeObjectURL(doneUrl)
    },
    [doneUrl],
  )

  /** Clamp panning so the image always covers the frame. */
  const clampOffset = useCallback(
    (next: { x: number; y: number }, z: number) => {
      const frame = frameRef.current
      const img = imgRef.current
      if (!frame || !img?.naturalWidth) return next
      const fw = frame.clientWidth
      const fh = frame.clientHeight
      const base = Math.max(fw / img.naturalWidth, fh / img.naturalHeight)
      const w = img.naturalWidth * base * z
      const h = img.naturalHeight * base * z
      const maxX = Math.max(0, (w - fw) / 2)
      const maxY = Math.max(0, (h - fh) / 2)
      return {
        x: Math.min(maxX, Math.max(-maxX, next.x)),
        y: Math.min(maxY, Math.max(-maxY, next.y)),
      }
    },
    [],
  )

  const applyCrop = () => {
    const frame = frameRef.current
    const img = imgRef.current
    if (!frame || !img?.naturalWidth) return
    const fw = frame.clientWidth
    const fh = frame.clientHeight
    const base = Math.max(fw / img.naturalWidth, fh / img.naturalHeight)
    const scale = base * zoom
    // Source rect in natural-image pixels for what the frame shows.
    const sw = fw / scale
    const sh = fh / scale
    const sx = (img.naturalWidth - sw) / 2 - offset.x / scale
    const sy = (img.naturalHeight - sh) / 2 - offset.y / scale

    const outW = Math.min(OUT_WIDTH, Math.round(sw))
    const outH = Math.round(outW / aspect)
    const canvas = document.createElement('canvas')
    canvas.width = outW
    canvas.height = outH
    canvas.getContext('2d')!.drawImage(img, sx, sy, sw, sh, 0, 0, outW, outH)
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
        const url = URL.createObjectURL(blob)
        setDoneUrl(url)
        onCropped(file, url)
      },
      'image/jpeg',
      0.9,
    )
  }

  const reset = () => {
    if (rawUrl) URL.revokeObjectURL(rawUrl)
    setRawUrl(null)
    setDoneUrl(null)
    onClear?.()
  }

  const frameHeight = compact ? '9rem' : '14rem'

  // ---- 3 states: empty dropzone → cropping → done -------------------------
  if (doneUrl) {
    return (
      <div className="flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element -- local preview */}
        <img
          src={doneUrl}
          alt=""
          className={`border border-rule object-cover ${round ? 'h-16 w-16 rounded-full' : 'h-16 rounded-sm'}`}
          style={round ? undefined : { aspectRatio: String(aspect) }}
        />
        <button
          type="button"
          onClick={reset}
          className="cursor-pointer border-none bg-transparent p-0 font-mono text-[0.8125rem] tracking-[0.08em] text-slate uppercase underline-offset-4 hover:underline"
        >
          Change
        </button>
      </div>
    )
  }

  if (rawUrl) {
    return (
      <div className="grid gap-2.5">
        <div
          ref={frameRef}
          className={`relative touch-none overflow-hidden border border-ink/40 bg-pan-deep select-none ${round ? 'rounded-full' : 'rounded-sm'}`}
          style={{ aspectRatio: String(aspect), maxHeight: frameHeight, cursor: 'grab', margin: round ? '0 auto' : undefined, width: round ? frameHeight : undefined }}
          onPointerDown={(e) => {
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
            pointer.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }
          }}
          onPointerMove={(e) => {
            if (!pointer.current) return
            setOffset(clampOffset({ x: e.clientX - pointer.current.x, y: e.clientY - pointer.current.y }, zoom))
          }}
          onPointerUp={() => (pointer.current = null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- crop stage */}
          <img
            ref={imgRef}
            src={rawUrl}
            alt=""
            draggable={false}
            onLoad={(e) => {
              // Render at explicit cover size: the element must be LARGER than
              // the frame so panning reveals real image, not empty space.
              const img = e.currentTarget
              const frame = frameRef.current
              if (!frame) return
              const base = Math.max(
                frame.clientWidth / img.naturalWidth,
                frame.clientHeight / img.naturalHeight,
              )
              setDims({ w: img.naturalWidth * base, h: img.naturalHeight * base })
            }}
            className="absolute top-1/2 left-1/2 max-w-none"
            style={{
              transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              width: dims ? `${dims.w}px` : '100%',
              height: dims ? `${dims.h}px` : '100%',
              objectFit: dims ? undefined : 'cover',
            }}
          />
        </div>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            aria-label="Zoom"
            onChange={(e) => {
              const z = Number(e.target.value)
              setZoom(z)
              setOffset((o) => clampOffset(o, z))
            }}
            className="w-32 accent-(--color-flame)"
          />
          <button type="button" onClick={applyCrop} className="btn-primary !px-4 !py-1.5">
            Use photo
          </button>
          <button
            type="button"
            onClick={reset}
            className="cursor-pointer border-none bg-transparent p-0 font-mono text-[0.8125rem] tracking-[0.08em] text-slate uppercase underline-offset-4 hover:underline"
          >
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => fileRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragOver(true)
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragOver(false)
        takeFile(e.dataTransfer.files?.[0])
      }}
      className={`grid w-full cursor-pointer place-items-center rounded-sm border-2 border-dashed px-4 text-center transition-colors ${
        dragOver ? 'border-flame bg-wash' : 'border-rule hover:border-slate'
      }`}
      style={{ minHeight: compact ? '5.5rem' : '8rem' }}
    >
      <span className="grid gap-1">
        <span className="font-body text-[0.9375rem] font-semibold text-ink">
          Drop a photo here
        </span>
        <span className="font-mono text-[0.75rem] tracking-[0.06em] text-slate uppercase">
          browse · drag · paste (Ctrl+V)
        </span>
      </span>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => takeFile(e.target.files?.[0])}
      />
    </button>
  )
}
