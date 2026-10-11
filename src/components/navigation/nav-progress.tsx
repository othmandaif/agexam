"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Événement envoyé par les navigations lancées en code (filtres, recherche…). */
export const NAV_START_EVENT = "agexam:nav-start";

export function startNavProgress() {
  window.dispatchEvent(new Event(NAV_START_EVENT));
}

/**
 * Barre de chargement en haut de l'écran pendant les changements de page :
 * clic sur un lien interne, retour navigateur, filtres et pagination.
 * N'apparaît qu'après 120 ms (pas de clignotement sur les pages rapides).
 */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [progress, setProgress] = useState<number | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const trickle = useRef<ReturnType<typeof setInterval> | null>(null);
  const active = useRef(false);
  const visible = useRef(false);
  const finishRef = useRef<() => void>(() => undefined);

  const clearAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (trickle.current) clearInterval(trickle.current);
    trickle.current = null;
  };

  // Démarrage
  useEffect(() => {
    const start = () => {
      if (active.current) return;
      active.current = true;
      clearAll();
      setLeaving(false);
      timers.current.push(
        setTimeout(() => {
          visible.current = true;
          setProgress(0.15);
          trickle.current = setInterval(
            () => setProgress((p) => (p === null ? p : Math.min(0.9, p + (0.9 - p) * 0.12))),
            250,
          );
        }, 120),
        // Sécurité : jamais de barre bloquée.
        setTimeout(() => finish(), 15_000),
      );
    };
    const finish = () => {
      if (!active.current) return;
      active.current = false;
      clearAll();
      if (!visible.current) return; // page rapide : la barre n'a jamais été montrée
      visible.current = false;
      setProgress(1);
      setLeaving(true);
      timers.current.push(
        setTimeout(() => {
          setProgress(null);
          setLeaving(false);
        }, 400),
      );
    };
    finishRef.current = finish;

    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)
        return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || !a.href || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname.startsWith("/api/")) return;
      const here = window.location.pathname + window.location.search;
      if (url.pathname + url.search === here) return; // ancre ou même page
      start();
    };
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", start);
    window.addEventListener(NAV_START_EVENT, start);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", start);
      window.removeEventListener(NAV_START_EVENT, start);
      clearAll();
    };
  }, []);

  // Fin : la nouvelle URL est rendue.
  useEffect(() => {
    finishRef.current();
  }, [pathname, search]);

  if (progress === null) return null;
  return (
    <div
      role="progressbar"
      aria-label="Chargement de la page"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progress * 100)}
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      style={{ opacity: leaving ? 0 : 1, transition: "opacity 300ms ease-out 100ms" }}
    >
      <div
        className="h-full origin-left bg-primary shadow-[0_0_8px_rgba(49,91,239,0.6)]"
        style={{
          transform: `scaleX(${progress})`,
          transition: "transform 250ms ease-out",
        }}
      />
    </div>
  );
}
