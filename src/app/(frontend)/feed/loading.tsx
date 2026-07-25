import { CardGridSkeleton, HeaderSkeleton } from '@/components/Skeletons'

export default function Loading() {
  return (
    <div className="shell py-8 lg:py-14">
      <div className="max-w-[46rem]">
        <HeaderSkeleton />
      </div>
      <div className="mt-10">
        <CardGridSkeleton count={6} />
      </div>
    </div>
  )
}
