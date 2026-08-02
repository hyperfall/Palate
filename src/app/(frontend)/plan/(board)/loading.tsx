import { HeaderSkeleton } from '@/components/Skeletons'

/**
 * Lives in the (board) route group, and must stay there.
 *
 * A loading.tsx creates a Suspense boundary over its whole subtree, and a
 * flushed shell commits the response as 200 — so any page below it that calls
 * notFound() answers "200 OK" with a not-found body. Sitting at plan/ directly,
 * this file did exactly that to /plan/shared/[token]: a revoked or expired
 * share link looked gone but reported success. The route group scopes the
 * boundary to /plan alone without changing the URL. See tests/unit/softNotFound.
 */
export default function Loading() {
  return (
    <div className="shell py-10 lg:py-14">
      <div className="max-w-[56ch]">
        <HeaderSkeleton />
      </div>
      <div className="mt-8 grid gap-4 xl:grid-cols-7">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="skeleton h-44 w-full" aria-hidden="true" />
        ))}
      </div>
      <div className="mt-14 grid gap-3 border-t-2 border-ink pt-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="skeleton h-6 w-full max-w-[36rem]" aria-hidden="true" />
        ))}
      </div>
    </div>
  )
}
