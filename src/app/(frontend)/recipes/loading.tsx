import { CardGridSkeleton, HeaderSkeleton } from '@/components/Skeletons'

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
