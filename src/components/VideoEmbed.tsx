/**
 * Safe creator-video embed. A creator-supplied URL is untrusted, so it never
 * becomes a raw iframe src — that would be an XSS / clickjacking vector.
 * Instead we parse the URL, extract only the video id, and rebuild the embed
 * URL from a hardcoded provider template. Anything we don't recognise falls
 * back to a plain outbound link — never an iframe.
 *
 * Supported as embeds: YouTube (incl. Shorts), Vimeo, TikTok. Everything else
 * (Instagram Reels, etc.) renders as a "Watch on …" link.
 */

type Parsed = { src: string; vertical: boolean; provider: string }

function parseVideo(raw: string): Parsed | null {
  let u: URL
  try {
    u = new URL(raw.trim())
  } catch {
    return null
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
  const host = u.hostname.replace(/^www\./, '').toLowerCase()

  const yt = (id: string, vertical: boolean): Parsed => ({
    src: `https://www.youtube-nocookie.com/embed/${id}`,
    vertical,
    provider: 'YouTube',
  })

  if (host === 'youtu.be') {
    const id = u.pathname.slice(1).match(/^[\w-]{6,}/)?.[0]
    if (id) return yt(id, false)
  }
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const shorts = u.pathname.match(/^\/shorts\/([\w-]{6,})/)
    if (shorts) return yt(shorts[1], true)
    const embed = u.pathname.match(/^\/embed\/([\w-]{6,})/)
    if (embed) return yt(embed[1], false)
    const v = u.searchParams.get('v')?.match(/^[\w-]{6,}/)?.[0]
    if (v) return yt(v, false)
  }
  if (host === 'vimeo.com') {
    const id = u.pathname.match(/(\d{6,})/)?.[1]
    if (id) return { src: `https://player.vimeo.com/video/${id}`, vertical: false, provider: 'Vimeo' }
  }
  if (host === 'player.vimeo.com') {
    const id = u.pathname.match(/\/video\/(\d+)/)?.[1]
    if (id) return { src: `https://player.vimeo.com/video/${id}`, vertical: false, provider: 'Vimeo' }
  }
  if (host === 'tiktok.com') {
    const id = u.pathname.match(/\/video\/(\d{6,})/)?.[1]
    if (id) return { src: `https://www.tiktok.com/player/v1/${id}`, vertical: true, provider: 'TikTok' }
  }
  return null
}

export function VideoEmbed({ url, title }: { url: string; title: string }) {
  const parsed = parseVideo(url)

  if (!parsed) {
    let host = 'the source'
    try {
      host = new URL(url).hostname.replace(/^www\./, '')
    } catch {
      return null // not even a URL — show nothing rather than a broken link
    }
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener nofollow"
        className="inline-flex items-center gap-2 font-mono text-detail font-medium tracking-[0.08em] text-flame uppercase underline underline-offset-4"
      >
        Watch on {host} ↗
      </a>
    )
  }

  return (
    <div className={parsed.vertical ? 'mx-auto w-full max-w-[22rem]' : 'w-full max-w-[44rem]'}>
      <div
        className="relative overflow-hidden rounded-sm border border-ink/20 bg-pan"
        style={{ aspectRatio: parsed.vertical ? '9 / 16' : '16 / 9' }}
      >
        <iframe
          src={parsed.src}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 h-full w-full"
        />
      </div>
    </div>
  )
}
