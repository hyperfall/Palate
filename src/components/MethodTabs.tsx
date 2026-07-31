'use client'

import { useState } from 'react'

import { MarkdownStory } from '@/components/MarkdownStory'

/**
 * The Instructions ⇄ Story switch at the top of the method. Instructions (the
 * server-rendered steps, passed as children) are the default; when a creator has
 * written a Story it can be toggled in and it fully replaces the instructions —
 * a deliberate, opt-in read, never blocking the cook. With no story, this just
 * renders the instructions with no toggle.
 */
export function MethodTabs({ story, children }: { story?: string | null; children: React.ReactNode }) {
  const hasStory = Boolean(story && story.trim())
  const [view, setView] = useState<'instructions' | 'story'>('instructions')

  if (!hasStory) return <>{children}</>

  return (
    <div>
      <div className="mb-5 inline-flex rounded-full border border-rule p-0.5" role="tablist" aria-label="Recipe view">
        {(['instructions', 'story'] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={`rounded-full px-4 py-1.5 font-mono text-[0.75rem] tracking-[0.1em] uppercase transition-colors ${
              view === v ? 'bg-ink text-paper' : 'text-slate hover:text-ink'
            }`}
          >
            {v === 'instructions' ? 'Instructions' : 'Story'}
          </button>
        ))}
      </div>

      {view === 'instructions' ? (
        children
      ) : (
        // The prose measure is enforced inside MarkdownStory, which also owns
        // whether a contents rail sits beside it. Capping the wrapper at 70ch
        // here would leave the rail nowhere to go — the column is wide on xl
        // for step photos, and a story with a contents block can use that.
        <MarkdownStory markdown={story!} />
      )}
    </div>
  )
}
