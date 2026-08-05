import { absoluteUrl } from '@/lib/site'

/**
 * Outbound email.
 *
 * The studio tells creators "a person checks every recipe — usually within a
 * few days". Until now, approval published the recipe and told them nothing:
 * the only way to find out was to keep re-opening the dashboard. For the people
 * this platform is trying to recruit, that is the loop breaking at the moment
 * it matters most.
 *
 * Sends through Resend when RESEND_API_KEY is set. Without it, the message is
 * logged and the caller carries on — an unconfigured mailer must never be able
 * to fail an approval, and in development the log is the useful outcome anyway.
 */

type Mail = { to: string; subject: string; text: string }

// Truthy, not `??`: an empty EMAIL_FROM in .env is the common case while the
// mailer is being set up, and `??` only falls back on null/undefined — it would
// have sent with a blank From address rather than the default.
const FROM = process.env.EMAIL_FROM?.trim() || 'Palate <hello@palate.example>'

export async function sendEmail(mail: Mail): Promise<{ sent: boolean; reason?: string }> {
  const key = process.env.RESEND_API_KEY?.trim()
  if (!key) {
    console.info(`[email:unconfigured] → ${mail.to}\n${mail.subject}\n${mail.text}`)
    return { sent: false, reason: 'no RESEND_API_KEY' }
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: [mail.to], subject: mail.subject, text: mail.text }),
    })
    if (!res.ok) {
      // Include the provider's own message. A bare status is undiagnosable —
      // a 403 is "domain not verified", "sandbox sender can only reach your own
      // address", or "key lacks sending permission", and only the body says
      // which. Logged, not thrown: whatever triggered this already happened.
      const detail = await res.text().catch(() => '')
      console.error(`[email:failed] ${res.status} → ${mail.to} ${detail}`)
      return { sent: false, reason: `resend ${res.status}: ${detail.slice(0, 300)}` }
    }
    return { sent: true }
  } catch (error) {
    console.error('[email:error]', error)
    return { sent: false, reason: 'network' }
  }
}

/** Their recipe is live. Written the way the site talks, not the way software does. */
export function recipeApproved({ name, title, slug }: { name: string | null; title: string; slug: string }): Mail['text'] {
  return [
    name ? `${name},` : 'Hello,',
    '',
    `“${title}” passed review and is live on Palate, under your name, with your links.`,
    '',
    absoluteUrl(`/recipes/${slug}`),
    '',
    'It is on the board now. Anyone can cook it, save it to a shelf, or drop it into their week.',
    'Your dashboard shows how many people do.',
    '',
    absoluteUrl('/dashboard'),
    '',
    '— Palate',
  ].join('\n')
}

/** Not this one. Says why, and says the door is still open. */
export function recipeRejected({ name, title, reason }: { name: string | null; title: string; reason?: string | null }): Mail['text'] {
  return [
    name ? `${name},` : 'Hello,',
    '',
    `A person read “${title}” and it isn’t going live as it stands.`,
    '',
    reason ? `What stopped it: ${reason}` : 'It didn’t meet the bar for the board this time.',
    '',
    'This isn’t a strike against you and it isn’t automated. Send another whenever you like.',
    '',
    absoluteUrl('/studio'),
    '',
    '— Palate',
  ].join('\n')
}
