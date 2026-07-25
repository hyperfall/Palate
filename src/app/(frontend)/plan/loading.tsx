import { HeaderSkeleton } from '@/components/Skeletons'

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
