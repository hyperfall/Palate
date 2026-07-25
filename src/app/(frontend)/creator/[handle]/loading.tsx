import { CardGridSkeleton } from '@/components/Skeletons'

export default function Loading() {
  return (
    <div>
      <header className="bg-pan">
        <div className="shell py-12">
          <div className="flex items-center gap-5">
            <div className="h-[4.5rem] w-[4.5rem] shrink-0 rounded-full bg-milk/10" aria-hidden="true" />
            <div className="grid gap-2">
              <div className="h-8 w-52 rounded bg-milk/10" aria-hidden="true" />
              <div className="h-4 w-28 rounded bg-milk/10" aria-hidden="true" />
            </div>
          </div>
        </div>
      </header>
      <section className="shell py-10">
        <CardGridSkeleton count={6} />
      </section>
    </div>
  )
}
