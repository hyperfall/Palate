'use client'

import { useEffect, type RefObject } from 'react'

/**
 * Modal plumbing every dialog on the site needs and most were missing: move
 * focus in on open, trap Tab inside, close on Escape, restore focus to whatever
 * opened it, and lock the page behind from scrolling.
 *
 * Without the trap, a keyboard or screen-reader user tabs straight out of the
 * dialog into page content that is visually covered but still focusable — they
 * are then "typing" into something they cannot see. FilterPanel's drawer had
 * this right; the cookie banner, mobile nav, quiz nudge and cook mode did not.
 *
 * Pass the element that should receive focus — normally the dialog itself with
 * tabIndex={-1}, so the screen reader announces the dialog rather than a
 * random first control.
 */
export function useDialogFocus({
  open,
  ref,
  onClose,
  lockScroll = true,
}: {
  open: boolean
  ref: RefObject<HTMLElement | null>
  onClose: () => void
  /** Cook mode already owns body overflow; let it keep that. */
  lockScroll?: boolean
}) {
  useEffect(() => {
    if (!open) return

    const prevOverflow = document.body.style.overflow
    if (lockScroll) document.body.style.overflow = 'hidden'
    // Captured now, while it's still the live element — by cleanup the trigger
    // may have unmounted (the cookie banner replaces its own button).
    const restoreTo = document.activeElement as HTMLElement | null

    const focusables = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter(
        (el) =>
          !el.hasAttribute('disabled') &&
          el.getAttribute('aria-hidden') !== 'true' &&
          // checkVisibility covers display:none, visibility:hidden and
          // content-visibility. Environments without it (jsdom) keep the
          // element rather than silently emptying the trap.
          (el.checkVisibility?.() ?? true),
      )

    // A short timeout (not rAF) lands reliably after the opening click and the
    // mount settle; rAF can fire while the element is still being attached.
    const focusTimer = setTimeout(() => {
      const target = ref.current
      if (!target) return
      if (target.tabIndex < 0 && !target.hasAttribute('tabindex')) target.tabIndex = -1
      target.focus()
    }, 60)

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) {
        // Nothing focusable inside — keep focus on the dialog rather than
        // letting Tab escape to the page behind it.
        e.preventDefault()
        ref.current?.focus()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      const active = document.activeElement
      if (e.shiftKey && (active === first || active === ref.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      clearTimeout(focusTimer)
      if (lockScroll) document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKey)
      // Only pull focus back if it's still inside the closing dialog —
      // otherwise we'd yank it away from wherever the user moved on to.
      if (!ref.current || ref.current.contains(document.activeElement)) {
        restoreTo?.focus?.()
      }
    }
  }, [open, ref, onClose, lockScroll])
}
