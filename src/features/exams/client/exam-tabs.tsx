"use client";

import Link from "next/link";
import { useUrlParams } from "@/lib/use-url-params";
import { cn } from "@/lib/utils";

/** Onglets d'état ; ils gardent les autres filtres de l'URL. */
export function ExamTabs({
  tabs,
  active,
}: {
  tabs: { id: string; label: string; count: number }[];
  active: string;
}) {
  const { hrefWith } = useUrlParams();
  return (
    <nav aria-label="Filtrer par état" className="flex flex-wrap gap-1">
      {tabs.map((t) => (
        <Link
          key={t.id}
          href={hrefWith({ etat: t.id === "TOUS" ? null : t.id })}
          scroll={false}
          aria-current={active === t.id ? "page" : undefined}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13.5px] font-semibold no-underline transition-colors duration-150",
            active === t.id
              ? "bg-primary-wash text-primary"
              : "text-muted hover:bg-canvas hover:text-ink",
          )}
        >
          {t.label}
          <span className="rounded-full bg-surface px-1.5 text-[11px] ring-1 ring-line">
            {t.count}
          </span>
        </Link>
      ))}
    </nav>
  );
}
