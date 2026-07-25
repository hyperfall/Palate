import { HeaderSkeleton } from '@/components/Skeletons'

export default function Loading() {
  return (
    <div className="shell py-8 lg:py-14">
      <div className="max-w-[56ch]">
        <HeaderSkeleton />
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-24 w-full" aria-hidden="true" />
        ))}
      </div>
      <div className="mt-12 grid gap-3 border-t border-rule pt-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-full" aria-hidden="true" />
        ))}
      </div>
    </div>
  )
}
