/** Squelette affiché instantanément pendant le chargement d'une page (loading.tsx). */
export function PageSkeleton({ variant = "list" }: { variant?: "list" | "cards" }) {
  return (
    <div className="flex animate-pulse flex-col gap-7" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      <div className="flex items-center gap-4">
        <div className="size-12 rounded-full bg-line-soft" />
        <div className="flex flex-col gap-2">
          <div className="h-6 w-56 rounded-[8px] bg-line-soft" />
          <div className="h-4 w-80 max-w-[60vw] rounded-[8px] bg-line-soft" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="h-[92px] rounded-card border border-line bg-surface" />
        ))}
      </div>
      {variant === "cards" ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-4">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="h-40 rounded-card border border-line bg-surface" />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="h-14 border-b border-line-soft" />
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 border-b border-line-soft px-5 py-4 last:border-0"
            >
              <div className="size-9 rounded-full bg-line-soft" />
              <div className="h-4 flex-1 rounded-[8px] bg-line-soft" />
              <div className="h-4 w-24 rounded-[8px] bg-line-soft" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
