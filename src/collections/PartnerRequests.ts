import type { CollectionConfig } from 'payload'

import { BUDGET_RANGES, DEFAULT_CREATOR_REV_SHARE } from '../lib/partners'

/**
 * Advertising partner intake. The public `/partners` form posts to
 * `/partners/apply`, which creates one of these server-side (public create
 * access stays OFF — the route uses the local API). Admins triage in /admin.
 *
 * Approval is scaffolding, not publishing: flipping status to `approved`
 * spins up an INACTIVE draft brand card pre-filled from the request, so the
 * targeting engine never sees a card until an admin adds the creative and
 * ticks `active`. Mirrors the Submissions → recipes promotion pattern.
 */
export const PartnerRequests: CollectionConfig = {
  slug: 'partnerRequests',
  labels: { singular: 'Partner request', plural: 'Partner requests' },
  admin: {
    useAsTitle: 'company',
    defaultColumns: ['company', 'contactEmail', 'status', 'createdAt'],
    group: 'Partnerships',
    description:
      'Advertising requests from /partners. Approve to scaffold an inactive draft brand card, then add creative and activate it.',
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    afterChange: [
      async ({ doc, previousDoc, req }) => {
        if (doc.status !== 'approved' || doc.scaffoldedCard) return doc
        if (previousDoc?.status === 'approved') return doc

        const payload = req.payload
        const tagline = String(doc.promoting ?? '')
          .trim()
          .replace(/\s+/g, ' ')
          .slice(0, 160)

        // Draft: inactive, weightless-until-reviewed creative is missing. The
        // engine filters on `active`, so this can't render until an admin
        // finishes it. `req` keeps the write inside the approval transaction.
        const card = await payload.create({
          collection: 'brandCards',
          req,
          data: {
            brand: doc.company,
            tagline: tagline || `${doc.company} — partner`,
            ctaLabel: 'Shop now',
            ctaUrl: doc.website,
            targetRegions: (doc.targetRegions ?? []).map((r: { code: string }) => ({ code: r.code })),
            revSharePercent: DEFAULT_CREATOR_REV_SHARE,
            weight: 1,
            active: false,
          } as never,
        })

        await payload.update({
          collection: 'partnerRequests',
          id: doc.id,
          data: { scaffoldedCard: card.id },
          req,
        })
        return doc
      },
    ],
  },
  fields: [
    { name: 'company', type: 'text', required: true },
    {
      name: 'website',
      type: 'text',
      required: true,
      admin: { description: 'Becomes the brand card’s destination (rel="sponsored nofollow").' },
    },
    { name: 'contactName', type: 'text', required: true },
    { name: 'contactEmail', type: 'email', required: true },
    {
      name: 'promoting',
      type: 'textarea',
      required: true,
      admin: { description: 'What they want to advertise — seeds the card tagline.' },
    },
    {
      name: 'targetRegions',
      type: 'array',
      labels: { singular: 'Region', plural: 'Regions' },
      admin: { description: 'ISO country codes (US, GB, KR…) they want to reach. Empty = global.' },
      fields: [
        {
          name: 'code',
          type: 'text',
          required: true,
          maxLength: 2,
          hooks: {
            beforeValidate: [
              ({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value),
            ],
          },
        },
      ],
    },
    {
      name: 'budgetRange',
      type: 'select',
      options: BUDGET_RANGES.map((b) => ({ label: b.label, value: b.value })),
    },
    { name: 'message', type: 'textarea' },
    {
      name: 'status',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending review', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Declined', value: 'declined' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'scaffoldedCard',
      type: 'relationship',
      relationTo: 'brandCards',
      admin: { readOnly: true, position: 'sidebar', description: 'Draft card created on approval.' },
    },
    {
      name: 'reviewNotes',
      type: 'textarea',
      admin: { description: 'Internal. Why this was approved or declined.' },
    },
  ],
}
