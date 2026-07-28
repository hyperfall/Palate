'use client'

import { useEffect } from 'react'

/**
 * The last net. (frontend)/error.tsx catches anything thrown inside a page, but
 * it renders *within* the root layout — so if the layout itself throws, that
 * boundary never mounts and the reader gets Next's raw error screen.
 *
 * This replaces the document entirely, which is why it ships its own <html> and
 * <body> and inline styles: the stylesheet lives in the layout that just failed,
 * so no class name here can be trusted to resolve.
 */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '2rem',
          background: '#14100c',
          color: '#f6f2ea',
          fontFamily: 'ui-serif, Georgia, serif',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '34rem' }}>
          <p
            style={{
              margin: 0,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.75rem',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: '#e4572e',
            }}
          >
            The kitchen went dark
          </p>
          <h1 style={{ margin: '0.75rem 0 0', fontSize: 'clamp(1.75rem,4vw,2.75rem)', lineHeight: 1.1 }}>
            Service stopped.
          </h1>
          <p style={{ margin: '0.75rem auto 0', maxWidth: '38ch', lineHeight: 1.6, opacity: 0.8 }}>
            Something failed before the page could be laid out. Reloading usually brings it back.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '1.75rem',
              padding: '0.75rem 1.5rem',
              border: 'none',
              borderRadius: '4px',
              background: '#e4572e',
              color: '#fff',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: '0.75rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
