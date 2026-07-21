import { CardGridSkeleton, HeaderSkeleton } from '@/components/Skeletons'

export default function Loading() {
  return (
    <div className="shell py-10 lg:py-14">
      <div className="max-w-[40rem]">
        <HeaderSkeleton />
      </div>
      <div className="mt-10">
        <CardGridSkeleton count={9} />
      </div>
    </div>
  )
}
