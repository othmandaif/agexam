"use client";

import { Pause, Play, Radio } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { cn } from "@/lib/utils";

/**
 * Actualisation automatique d'une page serveur (résultats en direct, correction
 * en cours). Suspendue quand l'onglet est masqué ; peut être mise en pause.
 */
export function LiveRefresh({
  intervalSec = 20,
  label = "En direct",
  compact = false,
}: {
  intervalSec?: number;
  label?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [paused, setPaused] = useState(false);
  const [pending, start] = useTransition();
  const [at, setAt] = useState<Date | null>(null);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      start(() => {
        router.refresh();
        setAt(new Date());
      });
    }, intervalSec * 1000);
    return () => clearInterval(id);
  }, [paused, intervalSec, router]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[13px] font-semibold print:hidden",
        paused
          ? "border-line bg-canvas text-muted"
          : "border-success/30 bg-success-bg text-success",
      )}
    >
      <Radio
        className={cn("size-3.5", !paused && "animate-pulse", pending && "animate-spin")}
        aria-hidden
      />
      {paused ? "Pause" : label}
      {!compact && at && !paused ? (
        <span className="font-normal text-muted tabular-nums">
          ·{" "}
          {at.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
          })}
        </span>
      ) : null}
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        className="rounded-full p-0.5 hover:bg-black/5"
        aria-label={paused ? "Reprendre l'actualisation" : "Mettre en pause l'actualisation"}
      >
        {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
      </button>
    </span>
  );
}
