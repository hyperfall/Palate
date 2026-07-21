import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export const VISITOR_COOKIE = 'palate_rotation'

/**
 * Issues the opaque rotation key that `selectBrandCards` uses to give every
 * brand fair, evenly-spread exposure (design spec §6 step 3).
 *
 * Privacy: this is a random value with no personal data in it — not derived
 * from IP, user agent, or anything about the visitor. It exists solely so the
 * weighted round-robin is stable for one person across pages instead of
 * re-rolling on every render (which clumps). Nothing reads it but the rotation.
 */
export async function proxy(request: NextRequest) {
  const response = NextResponse.next()

  if (!request.cookies.get(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 90,
    })
  }

  // Supabase session refresh: expired auth cookies are renewed here so the
  // saved-recipes UI never sees a stale session. No-op until the env is set.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (supabaseUrl && supabaseKey) {
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookies) => {
          for (const { name, value, options } of cookies) {
            response.cookies.set(name, value, options)
          }
        },
      },
    })
    await supabase.auth.getUser()
  }

  return response
}

export const config = {
  // Public pages only — the admin panel and API have no brand slots to rotate.
  matcher: ['/((?!admin|api|_next/static|_next/image|favicon.ico).*)'],
}
