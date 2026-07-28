import { HeaderSkeleton } from '@/components/Skeletons'

export default function Loading() {
  return (
    <div className="shell py-10 lg:py-14">
      <div className="max-w-[40rem]">
        <HeaderSkeleton />
      </div>
      <div className="mt-8 grid max-w-[36rem] gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-12 w-full" />
        ))}
      </div>
    </div>
  )
}
