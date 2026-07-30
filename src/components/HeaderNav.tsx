'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Desktop primary nav with an active state — the current section reads in the
 * flame accent (everything else sits at muted milk). `prefixes` lets a section
 * light up on its detail routes too (Recipes on /recipes/[slug], Cuisines on
 * /cuisine/[slug]).
 */
const NAV = [
  { href: '/tonight', label: 'Tonight', prefixes: ['/tonight'] },
  { href: '/cook-from', label: 'Cook from', prefixes: ['/cook-from'] },
  { href: '/plan', label: 'Plan', prefixes: ['/plan'] },
  { href: '/students', label: 'Students', prefixes: ['/students'] },
  { href: '/recipes', label: 'Recipes', prefixes: ['/recipes', '/browse'] },
  // Sits next to Recipes: both are ways of reading the catalogue, one by
  // filter and one by what people actually voted for.
  { href: '/ranking/all', label: 'Ranking', prefixes: ['/ranking'] },
  { href: '/cuisines', label: 'Cuisines', prefixes: ['/cuisines', '/cuisine'] },
]

const isActive = (pathname: string, prefixes: string[]) =>
  prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`))

export function HeaderNav() {
  const pathname = usePathname() ?? ''
  return (
    <>
      {NAV.map((item) => {
        const active = isActive(pathname, item.prefixes)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={`font-mono text-[0.8125rem] font-medium tracking-[0.14em] uppercase no-underline transition-colors ${
              active ? 'text-flame' : 'text-milk/70 hover:text-milk'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </>
  )
}
