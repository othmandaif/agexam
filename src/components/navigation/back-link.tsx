"use client";

import { ArrowLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { readNavHistory } from "./nav-tracker";

/**
 * Bouton « Retour » uniforme. Destination fiable : `href` (repli), enrichie des
 * filtres et de la page de la dernière visite de cette liste (?q=&page=…).
 */
export function BackLink({
  href,
  children,
  className,
}: {
  href: Route | string;
  children: React.ReactNode;
  className?: string;
}) {
  const [target, setTarget] = useState<string>(href);
  useEffect(() => {
    const base = href.split("?")[0];
    const last = readNavHistory()
      .reverse()
      .find((u) => u.split("?")[0] === base);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture du sessionStorage après hydratation
    if (last && last !== href) setTarget(last);
  }, [href]);

  return (
    <Link
      href={target as Route}
      aria-label={`Retour : ${typeof children === "string" ? children : "page précédente"}`}
      className={cn(
        "group -ml-1 inline-flex w-fit max-w-full items-center gap-1.5 rounded-[8px] py-1 pr-2 pl-1 text-[13.5px] font-semibold text-muted no-underline transition-colors duration-150",
        "hover:bg-canvas hover:text-ink focus-visible:text-ink active:bg-line-soft",
        "aria-disabled:pointer-events-none aria-disabled:opacity-50 print:hidden",
        className,
      )}
    >
      <ArrowLeft
        className="size-4 transition-transform duration-200 group-hover:-translate-x-0.5"
        aria-hidden
      />
      <span className="truncate">{children}</span>
    </Link>
  );
}
