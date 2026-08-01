'use client'

import dynamic from 'next/dynamic'
import { useState } from 'react'

import type { CookStep } from '@/lib/stepIngredients'
import type { CookIngredient, Finish } from '@/components/CookModeDialog'

/**
 * The button that opens cook mode, and nothing else.
 *
 * Cook mode itself is 500+ lines of dialog — step machine, timers, wake lock,
 * substitutions, rescue tips — and it lives behind a button that most readers
 * never press. It used to be in this file, so every visitor to every recipe
 * page downloaded and parsed it before deciding whether to cook.
 *
 * ssr: false because there is nothing to server-render: the dialog only exists
 * after a click, and it portals to the body.
 */
const CookMode = dynamic(() => import('@/components/CookModeDialog').then((m) => m.CookMode), {
  ssr: false,
})

export function CookModeLauncher({
  title,
  slug,
  image = null,
  steps,
  ingredients = [],
  baseServings = 1,
  finish = null,
}: {
  title: string
  slug: string
  image?: string | null
  steps: CookStep[]
  ingredients?: CookIngredient[]
  baseServings?: number
  finish?: Finish
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn-primary !py-2.5">
        Start cooking
      </button>
      <a
        href="#method"
        className="font-mono text-[0.8125rem] font-medium tracking-[0.12em] text-milk/80 uppercase underline underline-offset-4 hover:text-flame"
      >
        Read it first ↓
      </a>
      {open && (
        <CookMode
          title={title}
          slug={slug}
          image={image}
          steps={steps}
          ingredients={ingredients}
          baseServings={baseServings}
          finish={finish}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
