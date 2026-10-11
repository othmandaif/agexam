"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

const KEY = "agexam:nav";
const MAX = 30;

/** Dernières URL visitées dans l'app (chemin + filtres), pour les boutons « Retour ». */
export function readNavHistory(): string[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function NavTracker() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    const url = search ? `${pathname}?${search}` : pathname;
    try {
      const list = readNavHistory().filter((u) => u.split("?")[0] !== pathname);
      list.push(url);
      sessionStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)));
    } catch {
      // Stockage indisponible (navigation privée…) : le retour utilisera l'URL de repli.
    }
  }, [pathname, search]);
  return null;
}
