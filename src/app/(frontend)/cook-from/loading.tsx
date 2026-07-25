import { CardGridSkeleton, HeaderSkeleton } from '@/components/Skeletons'

export default function Loading() {
  return (
    <div className="shell py-8 lg:py-14">
      <div className="max-w-[46rem]">
        <HeaderSkeleton />
      </div>
      <div className="skeleton mt-8 h-11 w-full max-w-[40rem]" aria-hidden="true" />
      <div className="mt-10">
        <CardGridSkeleton count={6} />
      </div>
    </div>
  )
}
