import { MEAL_LABELS, WEEK_DAY_LABELS, weekDishCount, type WeekShoppingList, type WeekSnapshot } from './mealPlan'
import { SITE } from './site'
import { loadImages, resolveColors, resolveFonts, weekImageUrls, type ThemeColors, type ThemeFonts } from './weekExport'

/**
 * Paints a planned week (card + shopping list) onto a <canvas>, at 2× for a crisp
 * PNG. Theme-aware by construction: every colour is resolved from the live CSS
 * custom properties (so `light-dark()` + `data-theme` pick the active theme), and
 * fonts come from the same next/font variables the DOM uses. No html-to-image, no
 * SVG foreignObject — deterministic, and identical in every browser. Must run in
 * the browser (needs document + canvas). The PDF export is a separate vector
 * renderer (weekCardPdf).
 */

const CARD_W = 640
const PAD = 32

type Colors = ThemeColors
type Fonts = ThemeFonts

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Draw a same-origin thumbnail cover-fitted into a rounded square, or a dashed
 *  placeholder box when the image is missing. */
function thumb(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | undefined,
  x: number,
  y: number,
  size: number,
  colors: Colors,
) {
  ctx.save()
  roundRectPath(ctx, x, y, size, size, 6)
  if (img) {
    ctx.clip()
    const scale = Math.max(size / img.width, size / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, x + (size - dw) / 2, y + (size - dh) / 2, dw, dh)
  } else {
    ctx.fillStyle = colors.wash
    ctx.fill()
    ctx.strokeStyle = colors.rule
    ctx.setLineDash([3, 3])
    ctx.stroke()
  }
  ctx.restore()
  ctx.strokeStyle = colors.rule
  ctx.lineWidth = 1
  roundRectPath(ctx, x + 0.5, y + 0.5, size - 1, size - 1, 6)
  ctx.stroke()
}

type PaintCtx = {
  ctx: CanvasRenderingContext2D
  week: WeekSnapshot
  shopping: WeekShoppingList
  colors: Colors
  fonts: Fonts
  images: Map<string, HTMLImageElement>
  draw: boolean
}

/**
 * Single layout routine used twice: once to measure total height (draw=false),
 * once to actually paint (draw=true). Both passes flow the same `y` cursor so
 * the measured height matches the drawing exactly. Coordinates are CSS px; the
 * caller scales the canvas for retina output.
 */
function paint(p: PaintCtx): number {
  const { ctx, week, shopping, colors, fonts, images } = p
  const innerW = CARD_W - PAD * 2
  let y = 0

  const setFont = (weight: string | number, size: number, family: string) => {
    ctx.font = `${weight} ${size}px ${family}`
  }
  const wrap = (text: string, maxW: number): string[] => {
    const words = text.split(/\s+/)
    const lines: string[] = []
    let cur = ''
    for (const w of words) {
      const t = cur ? `${cur} ${w}` : w
      if (ctx.measureText(t).width > maxW && cur) {
        lines.push(cur)
        cur = w
      } else cur = t
    }
    if (cur) lines.push(cur)
    return lines.length ? lines : ['']
  }
  // Draw one line at the current y (textBaseline 'top'); does NOT advance y.
  const put = (
    text: string,
    x: number,
    size: number,
    opts: { family?: string; weight?: string | number; color?: string; align?: CanvasTextAlign; tracking?: number } = {},
  ) => {
    if (!p.draw) return
    setFont(opts.weight ?? 400, size, opts.family ?? fonts.body)
    ctx.fillStyle = opts.color ?? colors.ink
    ctx.textAlign = opts.align ?? 'left'
    ctx.textBaseline = 'top'
    ctx.letterSpacing = opts.tracking ? `${opts.tracking}px` : '0px'
    ctx.fillText(text, x, y)
    ctx.letterSpacing = '0px'
  }
  const rule = (yy: number, x0 = 0, x1 = CARD_W, w = 1, color = colors.rule) => {
    if (!p.draw) return
    ctx.strokeStyle = color
    ctx.lineWidth = w
    ctx.beginPath()
    ctx.moveTo(x0, yy + 0.5)
    ctx.lineTo(x1, yy + 0.5)
    ctx.stroke()
  }

  // ── Masthead ──────────────────────────────────────────────────────────────
  const count = weekDishCount(week)
  setFont(700, 40, fonts.display)
  const titleLines = wrap(week.title?.trim() || 'The week ahead', innerW)
  const mastTop = 28
  const titleLH = 44
  const mastHeadTop = y
  let mh = mastTop + 26 /*eyebrow row + gap*/ + titleLines.length * titleLH + 28 /*bottom pad*/
  if (week.weekOf?.trim()) mh += 22
  if (p.draw) {
    ctx.fillStyle = colors.pan
    ctx.fillRect(0, mastHeadTop, CARD_W, mh)
    let ty = mastHeadTop + mastTop
    y = ty
    put('This week’s service', PAD, 12, { family: fonts.mono, weight: 600, color: colors.flame, tracking: 1.4 })
    put(`${count} ${count === 1 ? 'dish' : 'dishes'}`, CARD_W - PAD, 12, {
      family: fonts.mono,
      color: colors.milk,
      align: 'right',
      tracking: 1.4,
    })
    ty += 26
    for (const l of titleLines) {
      y = ty
      put(l, PAD, 40, { family: fonts.display, weight: 700, color: colors.milk })
      ty += titleLH
    }
    if (week.weekOf?.trim()) {
      y = ty
      put(week.weekOf, PAD, 13, { family: fonts.mono, color: colors.milk })
    }
  }
  y = mastHeadTop + mh
  rule(y - 1, 0, CARD_W, 2, colors.ink)

  // ── Days ────────────────────────────────────────────────────────────────
  const dayColX = PAD
  const bodyX = PAD + 52
  const bodyW = CARD_W - bodyX - PAD
  for (const slot of week.days) {
    y += 16
    const empty = slot.meals.length === 0
    put(WEEK_DAY_LABELS[slot.day], dayColX, 13, {
      family: fonts.mono,
      weight: 600,
      color: empty ? colors.slate : colors.flame,
      tracking: 1.4,
    })
    if (empty) {
      put('— open —', bodyX, 13, { family: fonts.mono, color: colors.slate, tracking: 1 })
      y += 22
    } else {
      let by = y
      slot.meals.forEach((meal, mi) => {
        if (mi > 0) by += 14
        // meal label
        if (p.draw) {
          y = by
          put(MEAL_LABELS[meal.meal], bodyX, 11, { family: fonts.mono, weight: 500, color: colors.slate, tracking: 1.6 })
        }
        by += 18
        for (const dish of meal.dishes) {
          const thumbSize = 44
          if (p.draw) {
            thumb(ctx, dish.image ? images.get(dish.image) : undefined, bodyX, by, thumbSize, colors)
            y = by + thumbSize / 2 - 12
            setFont(400, 19, fonts.display)
            const dishLines = wrap(dish.title, bodyW - thumbSize - 12)
            put(dishLines[0] + (dishLines.length > 1 ? '…' : ''), bodyX + thumbSize + 12, 19, {
              family: fonts.display,
              color: colors.ink,
            })
          }
          by += thumbSize + 10
        }
      })
      y = by + 6
    }
    rule(y, 0, CARD_W)
  }

  // ── Shopping list ─────────────────────────────────────────────────────────
  y += 24
  rule(y, 0, CARD_W, 2, colors.ink)
  y += 14
  put('Shopping list', PAD, 24, { family: fonts.display, color: colors.ink })
  y += 38

  const listLine = (name: string, amounts: string[], indent = 0) => {
    const x = PAD + indent
    if (p.draw) {
      setFont(400, 16, fonts.body)
      ctx.fillStyle = colors.ink
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.letterSpacing = '0px'
      const nameW = ctx.measureText(name).width
      ctx.fillText(name, x, y)
      if (amounts.length) {
        ctx.fillStyle = colors.slate
        ctx.fillText(` — ${amounts.join(' + ')}`, x + nameW, y)
      }
    }
    y += 24
    rule(y - 6, PAD + indent, CARD_W - PAD)
  }

  // Everything to buy
  put('Everything to buy', PAD, 17, { family: fonts.display, color: colors.ink })
  y += 26
  if (shopping.netted.length === 0) {
    put('All set — every ingredient is a pantry staple.', PAD, 15, { family: fonts.body, color: colors.slate })
    y += 22
  } else {
    for (const l of shopping.netted) listLine(l.name, l.amounts)
  }

  // Per dish
  for (const dish of shopping.dishes) {
    y += 16
    put(dish.title, PAD, 17, { family: fonts.display, color: colors.ink })
    put(`${dish.lines.length} ${dish.lines.length === 1 ? 'item' : 'items'}`, CARD_W - PAD, 12, {
      family: fonts.mono,
      color: colors.slate,
      align: 'right',
      tracking: 1,
    })
    y += 26
    if (dish.lines.length === 0) {
      put('No ingredients recorded.', PAD + 12, 15, { family: fonts.body, color: colors.slate })
      y += 22
    } else {
      for (const l of dish.lines) listLine(l.name, l.amounts, 12)
    }
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  y += 24
  const fh = 56
  const footTop = y
  if (p.draw) {
    ctx.fillStyle = colors.wash
    ctx.fillRect(0, footTop, CARD_W, fh)
  }
  rule(footTop, 0, CARD_W, 2, colors.ink)
  if (p.draw) {
    y = footTop + 18
    put(SITE.name, PAD, 22, { family: fonts.display, color: colors.ink })
    put('Plan your week — cook first', CARD_W - PAD, 12, {
      family: fonts.mono,
      color: colors.slate,
      align: 'right',
      tracking: 1,
    })
  }
  y = footTop + fh

  return y
}

/** Render the week (card + shopping list) to a retina canvas. */
export async function renderWeekCanvas(opts: {
  week: WeekSnapshot
  shopping: WeekShoppingList
  scale?: number
}): Promise<HTMLCanvasElement> {
  const { week, shopping, scale = 2 } = opts
  const colors = resolveColors()
  const fonts = resolveFonts()

  await (document.fonts?.ready ?? Promise.resolve())
  const images = await loadImages(weekImageUrls(week.days))

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('canvas 2d context unavailable')

  // Pass 1 — measure (uses ctx.measureText; canvas size irrelevant yet).
  const height = paint({ ctx, week, shopping, colors, fonts, images, draw: false })

  // Size for retina, then Pass 2 — draw.
  canvas.width = Math.round(CARD_W * scale)
  canvas.height = Math.round(height * scale)
  ctx.scale(scale, scale)
  ctx.fillStyle = colors.card
  ctx.fillRect(0, 0, CARD_W, height)
  paint({ ctx, week, shopping, colors, fonts, images, draw: true })

  return canvas
}
