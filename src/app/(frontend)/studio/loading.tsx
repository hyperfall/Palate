import { HeaderSkeleton } from '@/components/Skeletons'

export default function Loading() {
  return (
    <div className="shell py-10 lg:py-14">
      <div className="max-w-[58ch]">
        <HeaderSkeleton />
      </div>
      <div className="mt-8 grid gap-10 xl:grid-cols-2">
        <div className="grid gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="skeleton h-11 w-full" aria-hidden="true" />
          ))}
        </div>
        <div className="skeleton hidden aspect-[4/3] w-full xl:block" aria-hidden="true" />
      </div>
    </div>
  )
}
