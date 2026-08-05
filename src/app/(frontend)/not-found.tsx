import Link from 'next/link'

/** 404 in ticket language — a docket that never made it to the pass. */
export default function NotFound() {
  return (
    <div className="shell grid min-h-[60vh] place-items-center py-16">
      <div className="ticket-card max-w-[34rem] p-8 text-center">
        <p className="eyebrow m-0 text-flame">Docket 404</p>
        <h1 className="mt-2 font-display text-[clamp(2rem,4vw,3rem)]">
          This ticket isn’t on the pass.
        </h1>
        <p className="mx-auto mt-3 max-w-[38ch] text-slate">
          Whatever you were after has been cleared, renamed, or never printed. No harm done.
          the kitchen’s still open.
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/recipes" className="btn-primary">
            Browse the board
          </Link>
          <Link
            href="/tonight"
            className="font-mono text-detail font-medium tracking-[0.12em] text-ink uppercase underline underline-offset-4 hover:text-flame"
          >
            Pick dinner for me →
          </Link>
        </div>
      </div>
    </div>
  )
}
