import type { CollectionConfig } from 'payload'

import { deriveTotalMinutes, recipeBodyFields, recipeFacetFields } from '../fields/recipeContent'
import { slugify } from '../fields/slug'
import { computeRecipeNutrition } from '../lib/recipeNutrition'

/**
 * Design spec §5 `submissions` — DESIGNED, NOT BUILT in Phase 1.
 *
 * There is no submission UI and no user auth in Phase 1 (§3, §9). This
 * collection exists so that when community content ships, it slots in without
 * a schema migration. It composes the *same* body and facet fields as
 * `recipes`, so the two cannot drift.
 *
 * Deliberately locked down: public read and public create are both off. Turning
 * community on is a Phase-2+ decision, not an accident of leaving a door open.
 */
export const Submissions: CollectionConfig = {
  slug: 'submissions',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'creatorName', 'creatorHandle', 'moderationStatus', 'createdAt'],
    group: 'Community',
    description:
      'Creator submissions from /studio. Approve to publish; promotion is automatic.',
    hidden: false,
  },
  access: {
    read: ({ req }) => Boolean(req.user),
    create: ({ req }) => Boolean(req.user),
    update: ({ req }) => Boolean(req.user),
    delete: ({ req }) => Boolean(req.user),
  },
  hooks: {
    beforeChange: [
      ({ data }) => {
        deriveTotalMinutes(data)
        return data
      },
    ],
    afterChange: [
      // Approval is promotion: the submission becomes a published recipe with
      // provenance 'community' and an author profile for the creator (§3, §5).
      async ({ doc, previousDoc, req }) => {
        if (doc.moderationStatus !== 'approved' || doc.promotedRecipe) return doc
        if (previousDoc?.moderationStatus === 'approved') return doc

        const payload = req.payload
        const relId = (v: unknown): number | undefined =>
          typeof v === 'object' && v ? (v as { id: number }).id : (v as number | undefined) ?? undefined

        // Fields that live only on the submission, never copied onto a recipe.
        const stripMeta = (d: Record<string, unknown>) => {
          const {
            id: _id, moderationStatus: _m, submittedBy: _s, submitterEmail: _se,
            creatorId: _ci, creatorName: _cn, creatorEmail: _ce, creatorHandle: _ch,
            creatorAvatar: _cav, promotedRecipe: _p, editsRecipe: _er, reviewNotes: _rn,
            videoUrl: _v, heroImage: _hi, storyImages: _si, createdAt: _ca, updatedAt: _ua,
            ...rest
          } = d
          return rest
        }
        const imageOverrides = (d: Record<string, unknown>) => ({
          ...(relId(d.heroImage) ? { heroImage: relId(d.heroImage) } : {}),
          ...(Array.isArray(d.storyImages)
            ? { storyImages: (d.storyImages as unknown[]).map(relId).filter((n): n is number => typeof n === 'number') }
            : {}),
          ...(d.videoUrl ? { videoUrl: d.videoUrl } : {}),
        })

        // Edit of an existing recipe → update it in place, keep its author/slug.
        const editId = relId(doc.editsRecipe)
        if (editId) {
          await payload.update({
            collection: 'recipes',
            id: editId,
            req,
            data: { ...stripMeta(doc as Record<string, unknown>), ...imageOverrides(doc as Record<string, unknown>) } as never,
          })
          const updated = await payload.findByID({ collection: 'recipes', id: editId, req }).catch(() => null)
          const nut = updated ? await computeRecipeNutrition(payload, updated as never).catch(() => null) : null
          if (nut) await payload.update({ collection: 'recipes', id: editId, data: { nutrition: nut } as never, req })
          await payload.update({ collection: 'submissions', id: doc.id, data: { promotedRecipe: editId }, req })
          return doc
        }

        const authorName = doc.creatorName || 'Palate community'
        const creatorId = (doc.creatorId as string | null) || null

        // Every nested write passes `req` so it runs inside the approval's own
        // transaction. Without it the self-update below deadlocks on this
        // submission's row lock, and a mid-way failure orphans the author/recipe.
        //
        // Dedup on the STABLE creator id, never the display name — two
        // different people called "John" must not collapse into one profile.
        const existing = creatorId
          ? await payload.find({
              collection: 'authors',
              where: { creatorId: { equals: creatorId } },
              limit: 1,
              req,
            })
          : await payload.find({
              collection: 'authors',
              where: { name: { equals: authorName } },
              limit: 1,
              req,
            })

        let author = existing.docs[0]
        if (!author) {
          // The author slug is unique, but two different creators can share a
          // display name — so suffix the slug when the base is already taken.
          const base = slugify(authorName) || 'creator'
          let slug = base
          for (let n = 2; ; n++) {
            const taken = await payload.find({
              collection: 'authors',
              where: { slug: { equals: slug } },
              limit: 1,
              req,
            })
            if (taken.totalDocs === 0) break
            slug = `${base}-${n}`
          }
          const avatarId = relId(doc.creatorAvatar)
          author = await payload.create({
            collection: 'authors',
            req,
            data: {
              name: authorName,
              slug,
              provenanceDefault: 'community',
              ...(creatorId ? { creatorId } : {}),
              ...(doc.creatorHandle ? { handle: doc.creatorHandle as string } : {}),
              ...(avatarId ? { avatar: avatarId } : {}),
            },
          })
        }

        const recipe = await payload.create({
          collection: 'recipes',
          req,
          data: {
            ...stripMeta(doc as Record<string, unknown>),
            ...imageOverrides(doc as Record<string, unknown>),
            author: author.id,
            provenance: 'community',
            status: 'published',
          } as never,
        })
        // Estimate nutrition from the recipe's ingredients (best-effort; a
        // low-coverage recipe just goes without rather than showing a wrong number).
        const nutrition = await computeRecipeNutrition(payload, recipe as never).catch(() => null)
        if (nutrition) {
          await payload.update({ collection: 'recipes', id: recipe.id, data: { nutrition } as never, req })
        }

        await payload.update({
          collection: 'submissions',
          id: doc.id,
          data: { promotedRecipe: recipe.id },
          req,
        })
        return doc
      },
    ],
  },
  fields: [
    ...recipeBodyFields({ requireHero: false }),
    ...recipeFacetFields(),
    {
      name: 'creatorId',
      type: 'text',
      index: true,
      admin: { description: 'Supabase user id of the creator who submitted this.' },
    },
    { name: 'creatorName', type: 'text' },
    { name: 'creatorEmail', type: 'text' },
    { name: 'creatorHandle', type: 'text' },
    {
      name: 'creatorAvatar',
      type: 'relationship',
      relationTo: 'media',
      admin: { description: 'The creator’s account avatar at submission time.' },
    },
    {
      name: 'videoUrl',
      type: 'text',
      admin: { description: 'Optional TikTok/YouTube/Reels link — creators are video-first.' },
    },
    {
      name: 'promotedRecipe',
      type: 'relationship',
      relationTo: 'recipes',
      admin: { readOnly: true, description: 'Set automatically when approved.' },
    },
    {
      name: 'editsRecipe',
      type: 'relationship',
      relationTo: 'recipes',
      admin: {
        readOnly: true,
        description: 'Set when a creator edits an existing recipe. On approval, that recipe is updated in place rather than a new one created.',
      },
    },
    {
      name: 'moderationStatus',
      type: 'select',
      required: true,
      defaultValue: 'pending',
      index: true,
      options: [
        { label: 'Pending review', value: 'pending' },
        { label: 'Approved', value: 'approved' },
        { label: 'Rejected', value: 'rejected' },
      ],
      admin: { position: 'sidebar' },
    },
    {
      name: 'submittedBy',
      type: 'relationship',
      relationTo: 'users',
      admin: {
        position: 'sidebar',
        description:
          'Legacy Payload-admin submitter link — unused for creator submissions. The real submitter is in Creator name / handle / email above (Supabase account).',
      },
    },
    {
      name: 'submitterEmail',
      type: 'email',
      admin: { description: 'Contact for the submitter before accounts exist.' },
    },
    {
      name: 'reviewNotes',
      type: 'textarea',
      admin: { description: 'Internal. Why this was approved or rejected.' },
    },
  ],
}
