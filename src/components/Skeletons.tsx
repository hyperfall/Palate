/**
 * Ticket-shaped loading skeletons — reused by every route's loading.tsx so
 * the wait reads as "the pass is plating", not a blank screen.
 */

export function CardSkeleton() {
  return (
    <div className="ticket-card overflow-hidden" aria-hidden="true">
      <div className="skeleton aspect-[4/3] w-full" style={{ borderRadius: 0 }} />
      <div className="grid gap-2 p-4">
        <div className="skeleton h-3 w-1/2" />
        <div className="skeleton h-5 w-4/5" />
        <div className="skeleton h-3 w-1/3" />
      </div>
    </div>
  )
}

export function CardGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}

export function HeaderSkeleton() {
  return (
    <div className="grid gap-3" aria-hidden="true">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton h-10 w-2/3" />
      <div className="skeleton h-4 w-1/2" />
    </div>
  )
}
