import { createReadStream, statSync } from 'node:fs'
import { Readable } from 'node:stream'
import { NextResponse, type NextRequest } from 'next/server'

import { ANIMATED_CONTENT_TYPES, animatedFileFor } from '@/lib/animated'

/**
 * Streams a cuisine's animation from `media/animated/<slug>.<ext>`.
 *
 * Range requests are load-bearing, not a nicety: Safari refuses to play any
 * <video> whose server answers a Range request with 200 instead of 206.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const file = animatedFileFor(slug)
  if (!file) return NextResponse.json({ error: 'Not found.' }, { status: 404 })

  const { size } = statSync(file.path)
  const headers: Record<string, string> = {
    'Content-Type': ANIMATED_CONTENT_TYPES[file.ext] ?? 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
  }

  const range = request.headers.get('range')
  const m = range?.match(/^bytes=(\d*)-(\d*)$/)
  if (m && (m[1] || m[2])) {
    const start = m[1] ? Number(m[1]) : Math.max(0, size - Number(m[2]))
    const end = m[1] && m[2] ? Math.min(Number(m[2]), size - 1) : size - 1
    if (start >= size || start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
    }
    const stream = Readable.toWeb(createReadStream(file.path, { start, end })) as ReadableStream
    return new Response(stream, {
      status: 206,
      headers: {
        ...headers,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
      },
    })
  }

  const stream = Readable.toWeb(createReadStream(file.path)) as ReadableStream
  return new Response(stream, { status: 200, headers: { ...headers, 'Content-Length': String(size) } })
}
