"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { PAGE_SIZES } from "@/lib/pagination";
import { useUrlParams } from "@/lib/use-url-params";
import { cn } from "@/lib/utils";

/** Pages à afficher : 1 … p-1 p p+1 … dernière. */
function pageList(page: number, last: number): (number | "…")[] {
  const set = new Set([1, last, page - 1, page, page + 1].filter((p) => p >= 1 && p <= last));
  const sorted = [...set].sort((a, b) => a - b);
  const out: (number | "…")[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push("…");
    out.push(p);
  });
  return out;
}

/**
 * Pagination côté serveur : liens ?page= (le serveur ne lit que la page
 * demandée) et choix du nombre d'éléments par page.
 */
export function Pagination({
  total,
  page,
  size,
  noun = "éléments",
}: {
  total: number;
  page: number;
  size: number;
  noun?: string;
}) {
  const { hrefWith, set, pending } = useUrlParams();
  const last = Math.max(1, Math.ceil(total / size));
  if (total === 0) return null;
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  const btn =
    "flex size-9 items-center justify-center rounded-[10px] text-[13.5px] font-semibold no-underline transition-colors duration-150";

  return (
    <nav
      aria-label="Pagination"
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 border-t border-line-soft px-5 py-3 text-[13px] text-muted",
        pending && "opacity-70",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {from}–{to} sur {total} {noun}
        </span>
        <label className="flex items-center gap-2">
          <span className="sr-only sm:not-sr-only">Par page</span>
          <select
            value={size}
            onChange={(e) => set({ taille: e.target.value })}
            className="h-8 rounded-[8px] border border-line bg-surface px-2 text-[13px] font-medium text-ink focus:border-primary focus:outline-none"
          >
            {PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      {last > 1 ? (
        <div className="flex items-center gap-1">
          <PageLink
            href={page > 1 ? hrefWith({ page: page - 1 }, false) : null}
            label="Page précédente"
            className={cn(btn, "border border-line text-ink hover:bg-canvas")}
          >
            <ChevronLeft className="size-4" aria-hidden />
          </PageLink>
          {pageList(page, last).map((p, i) =>
            p === "…" ? (
              <span key={`e${i}`} className="px-1" aria-hidden>
                …
              </span>
            ) : (
              <Link
                key={p}
                href={hrefWith({ page: p === 1 ? null : p }, false)}
                scroll={false}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  btn,
                  "tabular-nums",
                  p === page ? "bg-primary text-white" : "text-ink hover:bg-canvas",
                )}
              >
                {p}
              </Link>
            ),
          )}
          <PageLink
            href={page < last ? hrefWith({ page: page + 1 }, false) : null}
            label="Page suivante"
            className={cn(btn, "border border-line text-ink hover:bg-canvas")}
          >
            <ChevronRight className="size-4" aria-hidden />
          </PageLink>
        </div>
      ) : null}
    </nav>
  );
}

function PageLink({
  href,
  label,
  className,
  children,
}: {
  href: ReturnType<ReturnType<typeof useUrlParams>["hrefWith"]> | null;
  label: string;
  className: string;
  children: React.ReactNode;
}) {
  if (!href)
    return (
      <span aria-disabled className={cn(className, "opacity-40")} aria-label={label}>
        {children}
      </span>
    );
  return (
    <Link href={href} scroll={false} aria-label={label} className={className}>
      {children}
    </Link>
  );
}
