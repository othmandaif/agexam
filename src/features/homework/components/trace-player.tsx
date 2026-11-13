"use client";

import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { TraceFrame } from "@/domain/agsyntax/trace";
import { cn } from "@/lib/utils";

/**
 * Animation pas à pas : la ligne en cours est surlignée, les variables sont
 * dessinées en cases (une case change de couleur quand sa valeur change),
 * avec une courte explication. Le stagiaire avance à son rythme.
 */
export function TracePlayer({
  code,
  frames,
  inputs,
  truncated,
}: {
  code: string;
  frames: TraceFrame[];
  inputs?: string[];
  truncated?: boolean;
}) {
  const [i, setI] = useState(0);
  const lines = code.replace(/\r/g, "").split("\n");
  const frame = frames[Math.min(i, frames.length - 1)];
  const codeRef = useRef<HTMLOListElement>(null);
  const last = frames.length - 1;

  // La ligne courante reste visible dans le code.
  useEffect(() => {
    const el = codeRef.current?.querySelector<HTMLElement>("[data-current='true']");
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [i]);

  if (!frame) {
    return <p className="text-sm text-muted">Aucune étape à montrer pour cet algorithme.</p>;
  }

  return (
    <div
      className="flex flex-col gap-4"
      tabIndex={0}
      aria-label="Animation de l'algorithme"
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setI((n) => Math.min(last, n + 1));
        if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
      }}
    >
      {inputs?.length ? (
        <p className="text-[13px] text-muted">
          Exemple exécuté avec les saisies :{" "}
          <span className="font-mono font-semibold text-ink">{inputs.join(" · ")}</span>
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <ol
          ref={codeRef}
          className="m-0 max-h-[360px] list-none overflow-auto rounded-[12px] bg-[#0f172a] py-2 font-mono text-[13px] leading-[1.65] text-[#cbd5e1]"
        >
          {lines.map((text, n) => {
            const current = frame.line === n + 1;
            return (
              <li
                key={n}
                data-current={current}
                className={cn(
                  "flex gap-3 px-3 whitespace-pre transition-colors",
                  current && "bg-[#facc15]/20 text-white",
                )}
              >
                <span
                  className={cn(
                    "w-6 shrink-0 text-right select-none",
                    current ? "font-bold text-[#facc15]" : "text-[#475569]",
                  )}
                >
                  {current ? "▶" : n + 1}
                </span>
                <span>{text || " "}</span>
              </li>
            );
          })}
        </ol>

        <div className="flex min-w-0 flex-col gap-3">
          <p
            aria-live="polite"
            className="rounded-[12px] border border-[#f5d27a] bg-[#fffaf0] px-4 py-3 text-[14.5px] leading-relaxed text-ink"
          >
            <span className="mr-1.5 font-bold text-[#9a6b00]">Ligne {frame.line} ·</span>
            {frame.explain}
          </p>

          <div className="flex flex-col gap-2">
            <span className="text-[12.5px] font-bold tracking-wide text-muted uppercase">
              Variables
            </span>
            {frame.vars.length === 0 ? (
              <p className="text-[13px] text-muted">Aucune variable pour l&apos;instant.</p>
            ) : (
              <div className="flex flex-wrap gap-2.5">
                {frame.vars.map((v) => (
                  <div key={v.name} className="flex flex-col items-center gap-1">
                    {v.items ? (
                      <div className="flex">
                        {v.items.map((x, k) => (
                          <span
                            key={k}
                            className={cn(
                              "flex h-11 min-w-11 items-center justify-center border border-line bg-surface px-2 font-mono text-[14px] font-bold text-ink",
                              v.changed && "border-primary bg-primary-wash",
                            )}
                          >
                            {x}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span
                        key={`${v.name}-${v.value}`}
                        className={cn(
                          "flex h-12 min-w-14 items-center justify-center rounded-[10px] border-2 px-3 font-mono text-[16px] font-bold transition-colors",
                          v.changed
                            ? "animate-fade-in border-primary bg-primary-wash text-primary"
                            : "border-line bg-surface text-ink",
                          v.value === "?" && "text-faint",
                        )}
                      >
                        {v.value}
                      </span>
                    )}
                    <span className="font-mono text-[12.5px] font-semibold text-muted">
                      {v.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-bold tracking-wide text-muted uppercase">
              Écran
            </span>
            <pre className="m-0 max-h-32 min-h-10 overflow-auto rounded-field bg-[#0f172a] px-3 py-2 font-mono text-[12.5px] whitespace-pre-wrap text-[#e2e8f0]">
              {frame.output || " "}
            </pre>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          onClick={() => setI((n) => Math.max(0, n - 1))}
          disabled={i === 0}
        >
          <ChevronLeft aria-hidden /> Précédent
        </Button>
        <Button
          variant="mint"
          onClick={() => setI((n) => Math.min(last, n + 1))}
          disabled={i >= last}
        >
          Suivant <ChevronRight aria-hidden />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setI(0)} disabled={i === 0}>
          <RotateCcw aria-hidden /> Recommencer
        </Button>
        <span className="ml-auto text-[13px] font-semibold text-muted tabular-nums">
          Pas {i + 1} / {frames.length}
          {truncated ? " (début de l'exécution)" : ""}
        </span>
      </div>
      <div
        className="h-1.5 overflow-hidden rounded-full bg-canvas"
        role="progressbar"
        aria-valuenow={i + 1}
        aria-valuemin={1}
        aria-valuemax={frames.length}
        aria-label="Avancement de l'animation"
      >
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${((i + 1) / frames.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
