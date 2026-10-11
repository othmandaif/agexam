"use client";

import type { Route } from "next";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { startNavProgress } from "@/components/navigation/nav-progress";

/**
 * Filtres et pagination gardés dans l'URL (partageables, conservés au retour).
 * Toute modification d'un filtre revient à la page 1.
 */
export function useUrlParams() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  const hrefWith = useCallback(
    (patch: Record<string, string | number | null | undefined>, resetPage = true) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === undefined || v === "") next.delete(k);
        else next.set(k, String(v));
      }
      if (resetPage && !("page" in patch)) next.delete("page");
      const qs = next.toString();
      return (qs ? `${pathname}?${qs}` : pathname) as Route;
    },
    [params, pathname],
  );

  const set = useCallback(
    (patch: Record<string, string | number | null | undefined>, resetPage = true) => {
      const href = hrefWith(patch, resetPage);
      const here = window.location.pathname + window.location.search;
      if (href !== here) startNavProgress();
      start(() => router.replace(href, { scroll: false }));
    },
    [router, hrefWith],
  );

  return { params, hrefWith, set, pending };
}
