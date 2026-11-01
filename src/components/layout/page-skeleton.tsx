/** Squelette affiché instantanément pendant le chargement d'une page (loading.tsx). */
export function PageSkeleton({
  variant = "list",
}: {
  variant?: "list" | "cards" | "detail" | "workspace" | "map";
}) {
  if (variant === "detail") return <DetailSkeleton />;
  if (variant === "workspace") return <WorkspaceSkeleton />;
  if (variant === "map") return <MapSkeleton />;
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

function Header() {
  return (
    <div className="flex items-center gap-4">
      <div className="size-12 rounded-full bg-line-soft" />
      <div className="flex flex-col gap-2">
        <div className="h-6 w-56 rounded-[8px] bg-line-soft" />
        <div className="h-4 w-80 max-w-[60vw] rounded-[8px] bg-line-soft" />
      </div>
    </div>
  );
}

/** Copie, fiche, correction : en-tête puis blocs de contenu. */
function DetailSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      <Header />
      <div className="h-36 rounded-card border border-line bg-surface" />
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
          <div className="h-4 w-40 rounded-[8px] bg-line-soft" />
          <div className="h-5 w-3/4 rounded-[8px] bg-line-soft" />
          <div className="h-28 rounded-[10px] bg-line-soft/70" />
        </div>
      ))}
    </div>
  );
}

/** Éditeur d'algorithme + console. */
function WorkspaceSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      <Header />
      <div className="h-24 rounded-card border border-line bg-surface" />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="h-[380px] rounded-[12px] border border-line bg-surface" />
        <div className="h-[380px] rounded-[12px] bg-[#1e293b]/20" />
      </div>
    </div>
  );
}

/** Parcours d'entraînement : en-tête de jeu + niveaux. */
function MapSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Chargement…</span>
      <Header />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-40 rounded-card bg-primary/15" />
        <div className="h-40 rounded-card border border-line bg-surface" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex gap-4">
          <div className="size-14 shrink-0 rounded-2xl bg-line-soft" />
          <div className="h-32 flex-1 rounded-card border border-line bg-surface" />
        </div>
      ))}
    </div>
  );
}
