import { MEAL_LABELS, WEEK_DAY_LABELS, weekDishCount, type WeekShoppingList, type WeekSnapshot } from './mealPlan'
import { SITE } from './site'
import { loadImages, resolveColors, rgb, weekImageUrls } from './weekExport'

/**
 * Renders a planned week (card + shopping list) as a real VECTOR PDF with jsPDF
 * primitives — selectable text, crisp lines, tiny file — rather than a rasterised
 * canvas image. A4, paginated with automatic page breaks. Theme-aware: colours
 * come from the live CSS variables (dark theme → dark pages). Dish thumbnails are
 * cover-cropped to small JPEGs and embedded. Brand fonts map to jsPDF's built-in
 * vector families (serif/mono/sans) so nothing has to be embedded.
 */

type RGB = [number, number, number]

/** Cover-fit each image into a square JPEG data URL (addImage would otherwise
 *  stretch non-square photos). */
function squareThumbs(images: Map<string, HTMLImageElement>, size = 96): Map<string, string> {
  const out = new Map<string, string>()
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) return out
  for (const [url, img] of images) {
    ctx.clearRect(0, 0, size, size)
    const scale = Math.max(size / img.width, size / img.height)
    const dw = img.width * scale
    const dh = img.height * scale
    ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh)
    out.set(url, canvas.toDataURL('image/jpeg', 0.85))
  }
  return out
}

export async function renderWeekPdf(opts: { week: WeekSnapshot; shopping: WeekShoppingList }): Promise<Blob> {
  const { week, shopping } = opts
  const { jsPDF } = await import('jspdf')
  const colors = resolveColors()
  await (document.fonts?.ready ?? Promise.resolve())
  const thumbs = squareThumbs(await loadImages(weekImageUrls(week.days)))

  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const PW = doc.internal.pageSize.getWidth()
  const PH = doc.internal.pageSize.getHeight()
  const M = 44
  const innerW = PW - 2 * M

  const C: Record<'ink' | 'milk' | 'pan' | 'flame' | 'slate' | 'rule' | 'card' | 'wash', RGB> = {
    ink: rgb(colors.ink), milk: rgb(colors.milk), pan: rgb(colors.pan), flame: rgb(colors.flame),
    slate: rgb(colors.slate), rule: rgb(colors.rule), card: rgb(colors.card), wash: rgb(colors.wash),
  }
  const FONT = { display: 'times', mono: 'courier', body: 'helvetica' } as const

  let y = 0
  const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2])
  const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2])
  const paintBg = () => {
    fill(C.card)
    doc.rect(0, 0, PW, PH, 'F')
  }
  const setText = (font: keyof typeof FONT, style: 'normal' | 'bold', size: number, color: RGB) => {
    doc.setFont(FONT[font], style)
    doc.setFontSize(size)
    doc.setTextColor(color[0], color[1], color[2])
  }
  const hline = (x0: number, x1: number, yy: number, w = 0.5, color: RGB = C.rule) => {
    stroke(color)
    doc.setLineWidth(w)
    doc.line(x0, yy, x1, yy)
  }
  const newPage = () => {
    doc.addPage()
    paintBg()
    y = M
  }
  const ensure = (space: number) => {
    if (y + space > PH - M) newPage()
  }

  paintBg()

  // ── Masthead (first page only) ─────────────────────────────────────────────
  setText('display', 'bold', 24, C.milk)
  const titleLines = doc.splitTextToSize(week.title?.trim() || 'The week ahead', innerW) as string[]
  const mastH = 30 + 22 + titleLines.length * 26 + (week.weekOf?.trim() ? 16 : 0) + 20
  fill(C.pan)
  doc.rect(0, 0, PW, mastH, 'F')
  let my = 30
  setText('mono', 'bold', 9, C.flame)
  doc.text('THIS WEEK’S SERVICE', M, my, { baseline: 'top', charSpace: 1 })
  const count = weekDishCount(week)
  setText('mono', 'normal', 9, C.milk)
  doc.text(`${count} ${count === 1 ? 'DISH' : 'DISHES'}`, PW - M, my, { baseline: 'top', align: 'right', charSpace: 1 })
  my += 22
  setText('display', 'bold', 24, C.milk)
  for (const l of titleLines) {
    doc.text(l, M, my, { baseline: 'top' })
    my += 26
  }
  if (week.weekOf?.trim()) {
    setText('mono', 'normal', 9, C.milk)
    doc.text(week.weekOf, M, my, { baseline: 'top' })
  }
  y = mastH
  hline(0, PW, y, 1.5, C.ink)
  y += 10

  // ── Days ───────────────────────────────────────────────────────────────────
  const bodyX = M + 44
  for (const slot of week.days) {
    ensure(64)
    setText('mono', 'bold', 9, slot.meals.length ? C.flame : C.slate)
    doc.text(WEEK_DAY_LABELS[slot.day].toUpperCase(), M, y + 3, { baseline: 'top', charSpace: 1 })
    if (!slot.meals.length) {
      setText('mono', 'normal', 9, C.slate)
      doc.text('— OPEN —', bodyX, y + 3, { baseline: 'top' })
      y += 26
    } else {
      slot.meals.forEach((meal, mi) => {
        if (mi > 0) y += 8
        setText('mono', 'normal', 8, C.slate)
        doc.text(MEAL_LABELS[meal.meal].toUpperCase(), bodyX, y, { baseline: 'top', charSpace: 0.8 })
        y += 13
        for (const dish of meal.dishes) {
          ensure(36)
          const th = 28
          const data = dish.image ? thumbs.get(dish.image) : undefined
          if (data) {
            try {
              doc.addImage(data, 'JPEG', bodyX, y, th, th)
            } catch {
              /* skip a bad image */
            }
          }
          stroke(C.rule)
          doc.setLineWidth(0.5)
          doc.rect(bodyX, y, th, th)
          setText('display', 'normal', 13, C.ink)
          const dt = doc.splitTextToSize(dish.title, innerW - (bodyX - M) - th - 10) as string[]
          doc.text(dt[0] + (dt.length > 1 ? '…' : ''), bodyX + th + 10, y + 9, { baseline: 'top' })
          y += th + 8
        }
      })
      y += 6
    }
    hline(M, PW - M, y, 0.5, C.rule)
    y += 4
  }

  // ── Shopping list ───────────────────────────────────────────────────────────
  ensure(60)
  y += 12
  hline(0, PW, y, 1.5, C.ink)
  y += 12
  setText('display', 'bold', 16, C.ink)
  doc.text('Shopping list', M, y, { baseline: 'top' })
  y += 28

  const listLine = (name: string, amounts: string[], indent = 0) => {
    ensure(20)
    const x = M + indent
    setText('body', 'normal', 10, C.ink)
    doc.text(name, x, y, { baseline: 'top' })
    if (amounts.length) {
      const w = doc.getTextWidth(name)
      setText('body', 'normal', 10, C.slate)
      doc.text(` — ${amounts.join(' + ')}`, x + w, y, { baseline: 'top' })
    }
    y += 16
    hline(x, PW - M, y - 5, 0.4, C.rule)
  }

  // Everything to buy
  setText('display', 'bold', 12, C.ink)
  doc.text('Everything to buy', M, y, { baseline: 'top' })
  y += 22
  if (shopping.netted.length === 0) {
    setText('body', 'normal', 10, C.slate)
    doc.text('All set. Every ingredient is already a staple.', M, y, { baseline: 'top' })
    y += 18
  } else {
    for (const l of shopping.netted) listLine(l.name, l.amounts)
  }

  // Per dish
  for (const dish of shopping.dishes) {
    ensure(40)
    y += 12
    setText('display', 'bold', 12, C.ink)
    doc.text(dish.title, M, y, { baseline: 'top' })
    setText('mono', 'normal', 8, C.slate)
    doc.text(`${dish.lines.length} ${dish.lines.length === 1 ? 'ITEM' : 'ITEMS'}`, PW - M, y + 2, {
      baseline: 'top',
      align: 'right',
      charSpace: 0.8,
    })
    y += 22
    if (dish.lines.length === 0) {
      setText('body', 'normal', 10, C.slate)
      doc.text('No ingredients recorded.', M + 12, y, { baseline: 'top' })
      y += 18
    } else {
      for (const l of dish.lines) listLine(l.name, l.amounts, 12)
    }
  }

  // ── Footer ──────────────────────────────────────────────────────────────────
  ensure(48)
  y += 12
  fill(C.wash)
  doc.rect(0, y, PW, PH - y > 44 ? 44 : PH - y, 'F')
  hline(0, PW, y, 1.5, C.ink)
  setText('display', 'bold', 15, C.ink)
  doc.text(SITE.name, M, y + 15, { baseline: 'top' })
  setText('mono', 'normal', 8, C.slate)
  doc.text('PLAN YOUR WEEK — COOK FIRST', PW - M, y + 18, { baseline: 'top', align: 'right', charSpace: 0.8 })

  return doc.output('blob')
}
