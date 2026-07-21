import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  admin: { group: 'Content' },
  access: {
    read: () => true,
  },
  upload: {
    // Food photography is the product (§4), so we generate a real responsive set
    // rather than shipping one oversized original to every viewport.
    // withoutEnlargement: a small source must never be stretched up into a
    // blurry variant — the original stays the quality ceiling, and the
    // upscaler (images:upscale) is the only thing allowed to enlarge.
    imageSizes: [
      { name: 'thumbnail', width: 480, height: 360, position: 'centre', withoutEnlargement: true },
      { name: 'card', width: 800, height: 600, position: 'centre', withoutEnlargement: true },
      { name: 'hero', width: 1600, height: 1000, position: 'centre', withoutEnlargement: true },
      { name: 'og', width: 1200, height: 630, position: 'centre', withoutEnlargement: true },
    ],
    focalPoint: true,
    mimeTypes: ['image/*'],
  },
  fields: [
    {
      name: 'alt',
      type: 'text',
      required: true,
      admin: { description: 'Describe the dish for screen readers and for Google Images.' },
    },
    {
      name: 'caption',
      type: 'text',
    },
    {
      // §11 Q4 flags image sourcing (original vs. licensed vs. AI-generated) as
      // an open question with rights implications. Recording it per-asset means
      // the answer stays auditable instead of getting lost.
      name: 'credit',
      type: 'text',
      admin: { description: 'Photographer or source. Required for anything not shot in-house.' },
    },
    {
      name: 'license',
      type: 'select',
      defaultValue: 'original',
      options: [
        { label: 'Original (shot in-house)', value: 'original' },
        { label: 'Licensed / stock', value: 'licensed' },
        { label: 'AI-generated', value: 'ai-generated' },
        { label: 'Partner-supplied', value: 'partner' },
      ],
    },
  ],
}
