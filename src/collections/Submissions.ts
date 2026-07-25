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

        const {
          id: _id,
          moderationStatus: _m,
          submittedBy: _s,
          submitterEmail: _se,
          creatorId: _ci,
          creatorName: _cn,
          creatorEmail: _ce,
          creatorHandle: _ch,
          creatorAvatar: _cav,
          promotedRecipe: _p,
          reviewNotes: _rn,
          videoUrl: _v,
          heroImage: _hi,
          createdAt: _ca,
          updatedAt: _ua,
          ...body
        } = doc as Record<string, unknown> & { id: number }

        const recipe = await payload.create({
          collection: 'recipes',
          req,
          data: {
            ...(body as object),
            // heroImage may arrive populated (object) at this depth — pass the id.
            ...(relId(doc.heroImage) ? { heroImage: relId(doc.heroImage) } : {}),
            // storyImages likewise arrive populated — carry their ids.
            ...(Array.isArray(doc.storyImages)
              ? { storyImages: (doc.storyImages as unknown[]).map(relId).filter((n): n is number => typeof n === 'number') }
              : {}),
            // Carry the creator's video link onto the published recipe.
            ...(doc.videoUrl ? { videoUrl: doc.videoUrl } : {}),
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
