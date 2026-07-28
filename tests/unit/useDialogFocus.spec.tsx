import { cleanup, render, screen } from '@testing-library/react'
import { useRef } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { useDialogFocus } from '@/lib/useDialogFocus'

/**
 * The trap is what stops a keyboard user tabbing out of a modal into content
 * they cannot see. jsdom doesn't move focus on Tab by itself — which is fine
 * here, because the hook intercepts Tab and moves focus explicitly. That's
 * exactly the behaviour under test.
 */
function Dialog({ onClose, lockScroll }: { onClose?: () => void; lockScroll?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  useDialogFocus({ open: true, ref, onClose: onClose ?? (() => {}), lockScroll })
  return (
    <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Test">
      <button type="button">first</button>
      <button type="button">middle</button>
      <button type="button" disabled>
        skipped
      </button>
      <button type="button">last</button>
    </div>
  )
}

// Auto-cleanup only self-registers when vitest globals are on; they aren't
// here, so each test would otherwise inherit the previous test's DOM.
afterEach(cleanup)

const tab = (shift = false) =>
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true }))

describe('useDialogFocus', () => {
  it('moves focus into the dialog on open', async () => {
    vi.useFakeTimers()
    render(<Dialog />)
    await vi.advanceTimersByTimeAsync(100)
    expect(document.activeElement).toBe(screen.getByRole('dialog'))
    vi.useRealTimers()
  })

  it('wraps Tab from the last focusable back to the first', () => {
    render(<Dialog />)
    screen.getByText('last').focus()
    tab()
    expect(document.activeElement).toBe(screen.getByText('first'))
  })

  it('wraps Shift+Tab from the first focusable to the last', () => {
    render(<Dialog />)
    screen.getByText('first').focus()
    tab(true)
    expect(document.activeElement).toBe(screen.getByText('last'))
  })

  it('treats the dialog itself as the start, so Shift+Tab cannot escape it', () => {
    render(<Dialog />)
    screen.getByRole('dialog').focus()
    tab(true)
    expect(document.activeElement).toBe(screen.getByText('last'))
  })

  it('leaves interior Tab presses to the browser', () => {
    render(<Dialog />)
    const middle = screen.getByText('middle')
    middle.focus()
    tab()
    // Not first or last — the hook must not hijack normal traversal.
    expect(document.activeElement).toBe(middle)
  })

  it('skips disabled controls when finding the edges', () => {
    render(<Dialog />)
    // "skipped" is disabled, so "last" is the final stop, not it.
    screen.getByText('last').focus()
    tab()
    expect(document.activeElement).toBe(screen.getByText('first'))
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(<Dialog onClose={onClose} />)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('locks page scroll while open and restores it on close', () => {
    document.body.style.overflow = 'scroll'
    const view = render(<Dialog />)
    expect(document.body.style.overflow).toBe('hidden')
    view.unmount()
    expect(document.body.style.overflow).toBe('scroll')
  })

  it('leaves scroll alone when the caller owns it', () => {
    document.body.style.overflow = 'visible'
    render(<Dialog lockScroll={false} />)
    expect(document.body.style.overflow).toBe('visible')
  })

  it('restores focus to the opener when it closes', async () => {
    vi.useFakeTimers()
    const opener = document.createElement('button')
    document.body.appendChild(opener)
    opener.focus()
    const view = render(<Dialog />)
    await vi.advanceTimersByTimeAsync(100)
    expect(document.activeElement).not.toBe(opener)
    view.unmount()
    expect(document.activeElement).toBe(opener)
    opener.remove()
    vi.useRealTimers()
  })
})
