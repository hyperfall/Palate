'use client'

import { useEffect } from 'react'

/**
 * Light/dark switch. Theming is pure CSS (`light-dark()` + `color-scheme`):
 * with no `data-theme` attribute the site follows the system, so first paint
 * needs no boot script at all. This control stamps an explicit override and
 * records it; on mount it replays a stored override from a previous visit.
 */
function effectiveTheme(): 'dark' | 'light' {
  const set = document.documentElement.dataset.theme
  if (set === 'dark' || set === 'light') return set
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * `colorClass` sets the border + text colour so the control adapts to its
 * surface: milk on the dark pan header (default), ink on the light menu sheet.
 */
export function ThemeToggle({ colorClass = 'border-milk/30 text-milk' }: { colorClass?: string }) {
  useEffect(() => {
    try {
      const stored = localStorage.getItem('theme')
      if (stored === 'dark' || stored === 'light') {
        document.documentElement.dataset.theme = stored
      }
    } catch {
      // Private browsing — system preference it is.
    }
  }, [])

  const toggle = () => {
    const next = effectiveTheme() === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem('theme', next)
    } catch {
      // Private browsing — the choice just won't survive the tab.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark theme"
      className={`grid h-8 w-8 cursor-pointer place-items-center rounded border bg-transparent font-mono text-[0.9375rem] leading-none transition-colors hover:border-flame hover:text-flame ${colorClass}`}
    >
      <span className="light-only" aria-hidden="true">
        ☾
      </span>
      <span className="dark-only" aria-hidden="true">
        ☀
      </span>
    </button>
  )
}
