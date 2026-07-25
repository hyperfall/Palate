import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/**
 * Renders a creator's Story markdown. react-markdown is safe by default — raw
 * HTML in the source is escaped, so this can't inject scripts even though the
 * content is creator-authored. Images (`![alt](url)`) are styled to the reading
 * column; links open in a new tab. GFM adds tables/strikethrough/task lists.
 */
export function MarkdownStory({ markdown }: { markdown: string }) {
  return (
    <div className="story-prose max-w-[65ch] text-[1.0625rem] leading-relaxed text-ink">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: (props) => <h2 className="mt-8 mb-2 font-display text-[1.5rem] text-ink" {...props} />,
          h3: (props) => <h3 className="mt-6 mb-2 font-display text-[1.25rem] text-ink" {...props} />,
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
          // eslint-disable-next-line @next/next/no-img-element -- markdown image, arbitrary creator URL
          img: ({ node: _n, ...props }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="my-6 w-full rounded-lg border border-rule" alt={props.alt ?? ''} {...props} />
          ),
          code: (props) => <code className="rounded bg-wash px-1.5 py-0.5 font-mono text-[0.9em]" {...props} />,
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
