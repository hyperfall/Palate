import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import { deservesContents, headingId, outlineOf, readingTime } from '@/lib/storyOutline'

/**
 * Renders a creator's Story markdown. react-markdown is safe by default — raw
 * HTML in the source is escaped, so this can't inject scripts even though the
 * content is creator-authored. Images (`![alt](url)`) are styled to the reading
 * column; links open in a new tab. GFM adds tables/strikethrough/task lists.
 *
 * Headings carry stable ids so any section can be linked to directly, and a
 * contents block appears only when the story is long AND sectioned enough to
 * need one — see deservesContents. A short note gets none: a list of links
 * taller than the prose it indexes is furniture, not navigation.
 */
/** The text of a heading's rendered children, for id generation. */
function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (node && typeof node === 'object' && 'props' in node) {
    return textOf((node as { props: { children?: ReactNode } }).props.children)
  }
  return ''
}

export function MarkdownStory({
  markdown,
  contentsLayout = 'rail',
}: {
  markdown: string
  /**
   * Where the contents block sits. 'rail' puts it beside the prose from xl —
   * right for the article, which has the width. 'stacked' keeps it above, for
   * narrow hosts like the studio's editor column: measured there, the rail
   * squeezed the prose to 407px (~48 characters), below a readable measure AND
   * narrower than the 504px a reader actually gets. A preview that misreports
   * the reading width is worse than one that stacks.
   */
  contentsLayout?: 'rail' | 'stacked'
}) {
  const headings = outlineOf(markdown)
  const showContents = deservesContents(markdown, headings)
  const railed = showContents && contentsLayout === 'rail'
  const minutes = readingTime(markdown)

  // The renderer walks the source independently of outlineOf, so ids are
  // regenerated here in the same document order with the same collision rule —
  // that's what makes a contents link land on its heading.
  // headingId is pure, so the renderer and outlineOf independently derive the
  // same id for the same text — which is what makes a contents link land.

  const contents = showContents ? (
    <nav
      aria-label="In this story"
      // Above the prose on narrow screens, a sticky rail beside it from xl.
      // Sticky is the point of a side rail: a contents list that scrolls away
      // is just a header with extra steps.
      className={
        railed
          ? 'mb-8 border-y border-rule py-4 xl:sticky xl:top-24 xl:mb-0 xl:border-y-0 xl:border-l xl:py-0 xl:pl-5'
          : 'mb-8 border-y border-rule py-4'
      }
    >
      <p
        className={`eyebrow m-0 flex flex-wrap items-baseline justify-between gap-3 ${railed ? 'xl:block' : ''}`}
      >
        In this story
        {minutes && (
          <span className={`text-slate/70 ${railed ? 'xl:mt-1 xl:block' : ''}`}>{minutes}</span>
        )}
      </p>
      <ol className="m-0 mt-3 grid list-none gap-1.5 p-0">
        {headings.map((h) => (
          <li key={h.id} className={h.depth === 3 ? 'pl-4' : undefined}>
            <a
              href={`#${h.id}`}
              className="text-note leading-snug text-slate no-underline hover:text-flame hover:underline hover:underline-offset-4"
            >
              {h.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  ) : null

  return (
    <div
      className={
        railed
          ? // Prose keeps its 65ch measure; the rail takes the room the method
            // column already has at this width for step photos.
            'grid gap-x-10 xl:grid-cols-[minmax(0,65ch)_minmax(0,14rem)] xl:items-start'
          : 'max-w-[65ch]'
      }
    >
      {/* Source order puts the contents first so it precedes the prose for
          screen readers and on narrow screens; the grid moves it right at xl. */}
      {contents && <div className={railed ? 'xl:order-2' : undefined}>{contents}</div>}
      <div
        className={`story-prose max-w-[65ch] text-read leading-relaxed text-ink ${railed ? 'xl:order-1' : ''}`}
      >
        {/* Every story says how long it is. Only the CONTENTS is conditional —
            a short note still deserves the estimate, and it lived inside the
            nav at first, so stories under the threshold silently lost it. */}
        {!showContents && minutes && (
          <p className="m-0 mb-4 font-mono text-tag tracking-[0.08em] text-slate uppercase">
            {minutes}
          </p>
        )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // scroll-mt keeps a jumped-to heading clear of the sticky header.
          h2: ({ children, ...props }) => (
            <h2
              id={headingId(textOf(children))}
              className="mt-8 mb-2 scroll-mt-24 font-display text-[1.5rem] text-ink"
              {...props}
            >
              {children}
            </h2>
          ),
          h3: ({ children, ...props }) => (
            <h3
              id={headingId(textOf(children))}
              className="mt-6 mb-2 scroll-mt-24 font-display text-title text-ink"
              {...props}
            >
              {children}
            </h3>
          ),
          p: (props) => <p className="my-4 text-slate" {...props} />,
          ul: (props) => <ul className="my-4 list-disc pl-5 text-slate" {...props} />,
          ol: (props) => <ol className="my-4 list-decimal pl-5 text-slate" {...props} />,
          li: (props) => <li className="my-1" {...props} />,
          a: (props) => (
            <a target="_blank" rel="nofollow noopener" className="text-flame underline underline-offset-4" {...props} />
          ),
          blockquote: (props) => (
            <blockquote className="my-4 border-l-2 border-flame/50 pl-4 text-slate italic" {...props} />
          ),
          img: ({ node: _n, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element -- markdown image at an arbitrary creator URL; next/image can't optimise it
            <img className="my-6 w-full rounded-lg border border-rule" alt={props.alt ?? ''} {...props} />
          ),
          code: (props) => <code className="rounded bg-wash px-1.5 py-0.5 font-mono text-[0.9em]" {...props} />,
        }}
      >
        {markdown}
      </ReactMarkdown>
      </div>
    </div>
  )
}
