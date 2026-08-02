import { CardGridSkeleton, HeaderSkeleton } from '@/components/Skeletons'

/**
 * Lives in the (catalog) route group, and must stay there.
 *
 * At recipes/ directly this covered /recipes/[slug] too, and its Suspense
 * boundary flushed the shell before the page could call notFound() — so every
 * unknown recipe URL answered 200 with a not-found body, which is what search
 * engines index as a real page. The route group keeps the skeleton on the
 * catalogue without reaching the recipe pages. See tests/unit/softNotFound.
 */
export default function Loading() {
  return (
    <div className="shell py-10 lg:py-14">
      <div className="max-w-[46rem]">
        <HeaderSkeleton />
      </div>
      <div className="mt-10 grid gap-8 lg:grid-cols-[16rem_1fr]">
        <div className="skeleton hidden h-[32rem] w-full lg:block" aria-hidden="true" />
        <CardGridSkeleton count={9} />
      </div>
    </div>
  )
}
