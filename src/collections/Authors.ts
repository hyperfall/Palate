import type { CollectionConfig } from 'payload'

import { PROVENANCE } from '../lib/taxonomy'
import { slugField } from '../fields/slug'

/**
 * Design spec §5 `authors`. Feeds the `author` field of Recipe JSON-LD (§8) —
 * Google wants a named human behind a recipe, and §3 makes human verification
 * mandatory, so this is a trust signal, not decoration.
 */
export const Authors: CollectionConfig = {
  slug: 'authors',
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name', 'provenanceDefault', 'updatedAt'],
    group: 'Content',
  },
  access: {
    read: () => true,
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    slugField('name'),
    {
      name: 'creatorId',
      type: 'text',
      index: true,
      admin: {
        position: 'sidebar',
        readOnly: true,
        description: 'Supabase user id — the stable key that ties a creator to their profile.',
      },
    },
    {
      name: 'handle',
      type: 'text',
      unique: true,
      admin: { description: 'Public @handle shown on recipes and the creator profile.' },
    },
    {
      name: 'verified',
      type: 'checkbox',
      defaultValue: false,
      admin: {
        position: 'sidebar',
        description: 'Editorial trust mark — grant manually once you know the creator is real.',
      },
    },
    {
      name: 'avatar',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'bio',
      type: 'textarea',
      maxLength: 160,
      admin: { description: 'Short profile bio (max 160 chars). Creators can edit their own from /account.' },
    },
    {
      name: 'socials',
      type: 'group',
      admin: { description: 'Public social links. Creators can edit their own from /account.' },
      fields: [
        { name: 'instagram', type: 'text', admin: { description: 'Full URL, e.g. https://instagram.com/handle' } },
        { name: 'tiktok', type: 'text', admin: { description: 'Full URL, e.g. https://tiktok.com/@handle' } },
        { name: 'youtube', type: 'text', admin: { description: 'Full URL, e.g. https://youtube.com/@channel' } },
        { name: 'x', type: 'text', admin: { description: 'Full URL, e.g. https://x.com/handle' } },
        { name: 'website', type: 'text', admin: { description: 'Full URL, e.g. https://yoursite.com' } },
      ],
    },
    {
      name: 'provenanceDefault',
      type: 'select',
      required: true,
      defaultValue: 'authored',
      options: [...PROVENANCE],
      admin: {
        description:
          'Provenance applied to new recipes by this author unless overridden on the recipe itself.',
      },
    },
  ],
}
