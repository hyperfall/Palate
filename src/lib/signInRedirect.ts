'use client'

/**
 * Send someone to sign in, and bring them back.
 *
 * A subagent tapped "+ Save" on a recipe, landed on a bare sign-in form with no
 * explanation and no way back, and lost the servings and units it had set on
 * the way. Every one of these prompts interrupts something the person was
 * already doing, so each one records where they were.
 */
export function signInHref(): string {
  if (typeof window === 'undefined') return '/account'
  const here = window.location.pathname + window.location.search
  if (here.startsWith('/account')) return '/account'
  return `/account?next=${encodeURIComponent(here)}`
}
