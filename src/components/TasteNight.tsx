'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import type { TasteAxis } from '@/lib/taxonomy'
import { CookingLoader } from './CookingLoader'

type Nudge = Partial<Record<TasteAxis, number>>

type Question = {
  format: string
  prompt: string
  /** When present, the question shows this photo cropped-in until answered. */
  image?: string
  options: Array<{ label: string; nudge?: Nudge }>
  answer: number
  lesson: string
}

export type QuizDish = {
  title: string
  image: string | null
  cuisine: string | null
  totalLabel: string
}

/**
 * The Palate Quiz — every question earns its place by doing one of three
 * things: teaching a cooking skill, revealing the player's taste, or leading
 * to a dish. Wrong answers still nudge the hidden taste profile, so the
 * finale is always personal: a score AND tonight's recommended recipe.
 */
const BANK: Question[] = [
  {
    format: 'Guess the ingredient',
    prompt: 'Which paste gives gochujang its deep, fermented savouriness?',
    options: [
      { label: 'Fermented soybean & chilli', nudge: { spiciness: 1 } },
      { label: 'Tomato purée' },
      { label: 'Red miso', nudge: { richness: 1 } },
      { label: 'Tamarind' },
    ],
    answer: 0,
    lesson: 'Gochujang = chilli + glutinous rice + fermented soybean. Sweet-hot and deeply savoury.',
  },
  {
    format: 'Myth-buster',
    prompt: 'Does searing meat “lock in the juices”?',
    options: [
      { label: 'Yes — that’s the whole point' },
      { label: 'No — but it builds flavour', nudge: { richness: 1 } },
    ],
    answer: 1,
    lesson: 'Searing doesn’t seal anything — it creates browning (Maillard), which is flavour, not a lid.',
  },
  {
    format: 'Technique test',
    prompt: 'A roux is the base of which of these?',
    options: [
      { label: 'Velvety cheese sauce', nudge: { richness: 2 } },
      { label: 'Vinaigrette' },
      { label: 'Salsa verde', nudge: { spiciness: 1 } },
      { label: 'Whipped cream', nudge: { sweetness: 1 } },
    ],
    answer: 0,
    lesson: 'Flour cooked in fat thickens milk into béchamel — the mother of every proper cheese sauce.',
  },
  {
    format: 'True or false',
    prompt: 'Bananas are botanically berries.',
    options: [{ label: 'True', nudge: { sweetness: 1 } }, { label: 'False' }],
    answer: 0,
    lesson: 'True — and raspberries aren’t. Botany is chaos.',
  },
  {
    format: 'Cuisine passport',
    prompt: 'Kimchi is the fermented backbone of which cuisine?',
    options: [
      { label: 'Korean', nudge: { spiciness: 1 } },
      { label: 'Japanese' },
      { label: 'Thai' },
      { label: 'Chinese' },
    ],
    answer: 0,
    lesson: 'Korean — and a day-old pot of it makes the best kimchi jjigae.',
  },
  {
    format: 'Taste prediction',
    prompt: 'Which of these is most likely to score 5 on richness?',
    options: [
      { label: 'Som tam (green papaya salad)', nudge: { spiciness: 1 } },
      { label: 'Butter chicken', nudge: { richness: 2 } },
      { label: 'Chilled soba' },
      { label: 'Smashed cucumber salad' },
    ],
    answer: 1,
    lesson: 'Butter + cream + cashew gravy — that’s the decadent end of our richness meter.',
  },
  {
    format: 'Technique test',
    prompt: '“Blanching” means…',
    options: [
      { label: 'Boiling briefly, then icing' },
      { label: 'Cooking slowly in fat', nudge: { richness: 1 } },
      { label: 'Charring over flame', nudge: { spiciness: 1 } },
      { label: 'Whisking air into eggs' },
    ],
    answer: 0,
    lesson: 'A hot-cold shock that sets colour and texture — the secret behind restaurant-green vegetables.',
  },
  {
    format: 'This or that',
    prompt: 'Honest answer — tonight you’d rather cook:',
    options: [
      { label: 'Fiery and fast', nudge: { spiciness: 2, effort: -1 } },
      { label: 'Rich and slow', nudge: { richness: 2, effort: 2 } },
    ],
    answer: -1,
    lesson: 'No wrong answer — that one was about you.',
  },
  {
    format: 'Guess the ingredient',
    prompt: 'What gives Thai green curry its colour?',
    options: [
      { label: 'Green chillies & fresh herbs', nudge: { spiciness: 2 } },
      { label: 'Spinach purée' },
      { label: 'Matcha' },
      { label: 'Green peppercorns' },
    ],
    answer: 0,
    lesson: 'Green bird’s-eye chillies, coriander root, and basil — fresher and often hotter than red.',
  },
  {
    format: 'Myth-buster',
    prompt: 'Adding oil to pasta water stops it sticking.',
    options: [
      { label: 'True' },
      { label: 'False — stir early instead' },
    ],
    answer: 1,
    lesson: 'The oil floats; it mostly greases your drained pasta so sauce won’t cling. Stir in the first minute.',
  },
  {
    format: 'Taste prediction',
    prompt: 'The five basic tastes are sweet, sour, salty, bitter and…',
    options: [
      { label: 'Umami', nudge: { richness: 1 } },
      { label: 'Spicy', nudge: { spiciness: 1 } },
      { label: 'Fatty' },
      { label: 'Minty' },
    ],
    answer: 0,
    lesson: 'Umami — glutamate savouriness. Chilli heat is pain, not taste. Delicious pain.',
  },
  {
    format: 'This or that',
    prompt: 'Your comfort direction:',
    options: [
      { label: 'Buttery', nudge: { richness: 2 } },
      { label: 'Brothy', nudge: { richness: -1 } },
      { label: 'Crispy', nudge: { effort: 1 } },
      { label: 'Fiery', nudge: { spiciness: 2 } },
    ],
    answer: -1,
    lesson: 'Also about you. The board is listening.',
  },
]

const ROUND_SIZE = 8

type PickResult = {
  slug: string
  title: string
  cuisine: string | null
  cuisineFlag: string | null
  totalLabel: string
  image: { url: string; alt: string } | null
}

export function TasteNight({ dishes = [] }: { dishes?: QuizDish[] }) {
  // Sampled once per mount; reshuffled on replay via page reload.
  const round = useMemo(() => {
    // The image round: a real dish shown cropped-in, its title hidden among
    // three other dishes from the board. Strongest use of the photography.
    const withImages = [...dishes.filter((d) => d.image)].sort(() => Math.random() - 0.5)
    const photoQuestions: Question[] =
      withImages.length >= 4
        ? withImages.slice(0, 2).map((dish) => {
            const options = withImages
              .filter((d) => d.title !== dish.title)
              .slice(0, 3)
              .map((d) => ({ label: d.title }))
            const answer = Math.floor(Math.random() * 4)
            options.splice(answer, 0, { label: dish.title })
            return {
              format: 'Name the dish',
              prompt: 'Whose plate is this?',
              image: dish.image!,
              options,
              answer,
              lesson: `${dish.title} — ${dish.cuisine ?? 'from the board'}, ${dish.totalLabel}.`,
            }
          })
        : []

    const textQuestions = [...BANK]
      .sort(() => Math.random() - 0.5)
      .slice(0, ROUND_SIZE - photoQuestions.length)
    return [...textQuestions, ...photoQuestions].sort(() => Math.random() - 0.5)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [index, setIndex] = useState(0)
  const [chosen, setChosen] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [scoreable, setScoreable] = useState(0)
  const [prefs, setPrefs] = useState<Record<TasteAxis, number>>({
    spiciness: 2,
    sweetness: 2,
    richness: 2,
    effort: 2,
  })
  const [pick, setPick] = useState<PickResult | null>(null)
  const [finished, setFinished] = useState(false)

  const question = round[index]

  const choose = (optionIndex: number) => {
    if (chosen !== null) return
    setChosen(optionIndex)
    if (question.answer >= 0) {
      setScoreable((n) => n + 1)
      if (optionIndex === question.answer) setScore((s) => s + 1)
    }
    const nudge = question.options[optionIndex]?.nudge
    if (nudge) {
      setPrefs((p) => {
        const next = { ...p }
        for (const [axis, delta] of Object.entries(nudge)) {
          const key = axis as TasteAxis
          next[key] = Math.max(0, Math.min(5, next[key] + delta))
        }
        return next
      })
    }
  }

  const advance = async () => {
    if (index + 1 < round.length) {
      setIndex(index + 1)
      setChosen(null)
      return
    }
    setFinished(true)
    try {
      const params = new URLSearchParams(
        Object.fromEntries(Object.entries(prefs).map(([k, v]) => [k, String(v)])),
      )
      const res = await fetch(`/tonight/pick?${params}`)
      const data = await res.json()
      setPick(data.pick ?? null)
    } catch {
      setPick(null)
    }
  }

  if (finished) {
    return (
      <div>
        <p className="eyebrow m-0 text-flame">Final score</p>
        <h2 className="mt-2 text-[clamp(2rem,4vw,3.25rem)]">
          {score} / {scoreable}
        </h2>
        <p className="mt-3 max-w-[46ch] text-slate">
          Your answers lean{' '}
          {prefs.spiciness >= 3 ? 'spicy' : 'mild'}, {prefs.richness >= 3 ? 'rich' : 'light'},{' '}
          {prefs.sweetness >= 3 ? 'sweet-leaning' : 'savoury'} — so tonight the board recommends:
        </p>

        {pick ? (
          <Link
            href={`/recipes/${pick.slug}`}
            className="ticket-card mt-6 flex max-w-[34rem] items-center gap-4 p-4 no-underline"
          >
            {pick.image && (
              // eslint-disable-next-line @next/next/no-img-element -- client-fetched result
              <img
                src={pick.image.url}
                alt=""
                width={96}
                height={72}
                className="h-[72px] w-[96px] shrink-0 rounded-sm object-cover"
              />
            )}
            <span>
              <span className="eyebrow block">
                {[
                  pick.cuisine
                    ? `${pick.cuisineFlag ? `${pick.cuisineFlag} ` : ''}${pick.cuisine}`
                    : null,
                  pick.totalLabel,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <span className="mt-1 block font-display text-[1.25rem] text-ink">{pick.title}</span>
            </span>
          </Link>
        ) : (
          <div className="mt-6">
            <CookingLoader label="Consulting the board" />
          </div>
        )}

        <div className="mt-8 flex flex-wrap gap-4">
          {pick && (
            <Link href={`/recipes/${pick.slug}`} className="btn-primary">
              Cook it →
            </Link>
          )}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="cursor-pointer border-none bg-transparent p-0 font-mono text-[0.8125rem] tracking-[0.12em] text-slate uppercase underline-offset-4 hover:underline"
          >
            Play again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <p className="eyebrow m-0 text-flame">{question.format}</p>
        <span className="datum">
          {index + 1} / {round.length}
        </span>
      </div>
      <h2 className="mt-3 max-w-[26ch] text-[clamp(1.5rem,3vw,2.5rem)]">{question.prompt}</h2>

      {question.image && (
        <div className="mt-6 max-w-[28rem] overflow-hidden rounded-sm border border-ink/40 bg-card p-2 shadow-(--shadow-block-sm)">
          <div className="overflow-hidden rounded-[2px]">
            {/* eslint-disable-next-line @next/next/no-img-element -- quiz round, client-assembled */}
            <img
              src={question.image}
              alt="Mystery dish"
              width={800}
              height={500}
              className={`aspect-[8/5] w-full object-cover transition-transform duration-700 ${
                chosen === null ? 'scale-[1.75]' : 'scale-100'
              }`}
            />
          </div>
        </div>
      )}

      <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
        {question.options.map((option, i) => {
          const isAnswer = question.answer === i
          const revealed = chosen !== null && question.answer >= 0
          return (
            <button
              key={option.label}
              type="button"
              onClick={() => choose(i)}
              disabled={chosen !== null}
              className={`ticket-card cursor-pointer p-4 text-left font-mono text-[0.875rem] font-semibold disabled:cursor-default ${
                revealed && isAnswer ? 'outline-2 outline-richness' : ''
              } ${revealed && chosen === i && !isAnswer ? 'outline-2 outline-heat' : ''} ${
                chosen === i && question.answer < 0 ? 'outline-2 outline-flame' : ''
              }`}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {chosen !== null && (
        <div className="mt-6 border-t-2 border-ink pt-4">
          <p className="m-0 max-w-[58ch] text-[0.9375rem] leading-relaxed text-slate">
            {question.lesson}
          </p>
          <button type="button" onClick={() => void advance()} className="btn-primary mt-5">
            {index + 1 < round.length ? 'Next question →' : 'See my result →'}
          </button>
        </div>
      )}
    </div>
  )
}
