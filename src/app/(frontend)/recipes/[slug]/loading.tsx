export default function Loading() {
  return (
    <div aria-hidden="true">
      {/* Hero band */}
      <div className="skeleton min-h-[44vh] w-full lg:min-h-[52vh]" style={{ borderRadius: 0 }} />
      {/* Ticket band */}
      <div className="border-b border-rule bg-wash">
        <div className="shell grid gap-6 py-7 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="skeleton h-14 w-full" />
          ))}
        </div>
      </div>
      {/* Method + ingredients */}
      <div className="shell grid gap-12 py-10 lg:grid-cols-[20rem_1fr]">
        <div className="grid gap-3">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="skeleton h-4 w-full" />
          ))}
        </div>
        <div className="grid gap-5">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="skeleton h-6 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}
