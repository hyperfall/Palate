import 'dotenv/config'

import { recipeApproved, recipeRejected, sendEmail } from '../lib/email'

/**
 * Send one real creator email, to check the key, the From address and the copy
 * without having to approve a submission to find out.
 *
 *   npm run email:test -- you@example.com            # the approval message
 *   npm run email:test -- you@example.com rejected   # the rejection message
 *
 * Sends for real when RESEND_API_KEY is set; otherwise prints what would go out.
 * While EMAIL_FROM is still resend.dev's sandbox sender, delivery only works to
 * the address the Resend account is registered under.
 */
const to = process.argv[2]
const kind = process.argv[3] === 'rejected' ? 'rejected' : 'approved'

if (!to || !to.includes('@')) {
  console.error('Usage: npm run email:test -- you@example.com [approved|rejected]')
  process.exit(1)
}

const mail =
  kind === 'approved'
    ? {
        to,
        subject: '“Kimchi Jjigae” is live on Palate',
        text: recipeApproved({ name: 'Rahul', title: 'Kimchi Jjigae', slug: 'kimchi-jjigae' }),
      }
    : {
        to,
        subject: 'About “Kimchi Jjigae”',
        text: recipeRejected({
          name: 'Rahul',
          title: 'Kimchi Jjigae',
          reason: 'The photo is too dark to see the dish — daylight and a plain background would do it.',
        }),
      }

const result = await sendEmail(mail)
console.log(
  result.sent
    ? `Sent the ${kind} email to ${to}. From: ${process.env.EMAIL_FROM?.trim() || '(default)'}`
    : `NOT sent (${result.reason}). The message is logged above.`,
)
process.exit(result.sent ? 0 : 1)
