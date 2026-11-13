"use client";

import { ChevronLeft, ChevronRight, Lightbulb, Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { TraceVar } from "@/domain/agsyntax/trace";
import { cn } from "@/lib/utils";
import { recordHintViewAction } from "../server/actions";

export interface HintFrame {
  explain: string;
  vars: TraceVar[];
  output: string;
}

const STEP_MS = 2400;

/**
 * Indice visuel, toujours affiché et animé : on voit les cases mémoire se
 * remplir et l'écran s'écrire, avec une phrase à chaque pas — sans montrer
 * l'algorithme. Lecture automatique ; le stagiaire peut mettre en pause et
 * avancer à son rythme.
 */
export function VisualHint({
  stepId,
  frames,
  inputs,
}: {
  stepId: string;
  frames: HintFrame[];
  inputs: string[];
}) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const counted = useRef(false);
  const last = frames.length - 1;
  const frame = frames[Math.min(i, last)]!;

  // Lecture automatique (désactivée si l'utilisateur préfère moins d'animations).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- préférence du système
      setPlaying(false);
    }
  }, []);
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(
      () => setI((n) => (n >= last ? 0 : n + 1)),
      i >= last ? STEP_MS * 2 : STEP_MS,
    );
    return () => clearTimeout(t);
  }, [playing, i, last]);

  /** Le formateur voit l'indice comme « consulté » dès que le stagiaire s'en sert. */
  const interact = useCallback(() => {
    if (counted.current) return;
    counted.current = true;
    void recordHintViewAction(stepId);
  }, [stepId]);

  const go = (n: number) => {
    interact();
    setPlaying(false);
    setI(Math.max(0, Math.min(last, n)));
  };

  return (
    <section
      aria-label="Indice visuel"
      className="flex flex-col gap-5 overflow-hidden rounded-card border border-[#f5d27a] bg-[linear-gradient(180deg,#fffaf0,#fffdf8)] p-5 shadow-soft"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#fff1c2]">
            <Lightbulb className="size-5 text-[#d99a00]" aria-hidden />
          </span>
          <div className="flex flex-col">
            <h2 className="m-0 text-[16px] font-bold text-ink">
              Indice : voici ce que votre algorithme doit faire
            </h2>
            <p className="m-0 text-[13px] text-muted">
              {inputs.length ? (
                <>
                  Exemple avec les valeurs saisies{" "}
                  {inputs.map((v, k) => (
                    <span
                      key={k}
                      className="mx-0.5 inline-flex rounded-md bg-white px-1.5 font-mono font-bold text-ink ring-1 ring-line"
                    >
                      {v}
                    </span>
                  ))}
                </>
              ) : (
                "Exemple d'exécution, pas à pas."
              )}
            </p>
          </div>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-[12.5px] font-bold text-[#9a6b00] tabular-nums ring-1 ring-[#f5d27a]">
          Pas {i + 1} / {frames.length}
        </span>
      </header>

      {/* Ce qui se passe à ce pas */}
      <p
        key={`e-${i}`}
        aria-live="polite"
        className="animate-slide-in m-0 flex items-start gap-3 rounded-[14px] bg-white px-4 py-3.5 text-[16px] leading-relaxed font-semibold text-ink shadow-soft ring-1 ring-line"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white">
          {i + 1}
        </span>
        {frame.explain}
      </p>

      <div className="grid gap-5 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        {/* Mémoire : les variables en cases */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[12px] font-bold tracking-wide text-muted uppercase">
            Mémoire (les variables)
          </span>
          {frame.vars.length === 0 ? (
            <p className="text-[13px] text-muted">Aucune variable pour l&apos;instant.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {frame.vars.map((v) => (
                <div key={v.name} className="flex flex-col items-center gap-1.5">
                  {v.items ? (
                    <div className="flex">
                      {v.items.map((x, k) => (
                        <span
                          key={`${k}-${x}`}
                          className={cn(
                            "flex h-12 min-w-12 items-center justify-center border-y border-r border-line bg-white px-2 font-mono text-[15px] font-bold text-ink first:rounded-l-[10px] first:border-l last:rounded-r-[10px]",
                            v.changed && "animate-pop border-primary bg-primary-wash text-primary",
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
                        "flex h-14 min-w-16 items-center justify-center rounded-[12px] border-2 px-3 font-mono text-[19px] font-extrabold transition-colors",
                        v.value === "?"
                          ? "border-dashed border-line bg-white/60 text-faint"
                          : v.changed
                            ? "animate-pop border-primary bg-primary-wash text-primary shadow-[0_0_0_4px_rgba(49,91,239,0.12)]"
                            : "border-line bg-white text-ink",
                      )}
                    >
                      {v.value === "?" ? "vide" : v.value}
                    </span>
                  )}
                  <span className="font-mono text-[13px] font-bold text-muted">{v.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Ce qui s'affiche */}
        <div className="flex min-w-0 flex-col gap-2.5">
          <span className="text-[12px] font-bold tracking-wide text-muted uppercase">
            Écran (ce qui s&apos;affiche)
          </span>
          <pre className="m-0 min-h-[88px] overflow-auto rounded-[12px] bg-[#0f172a] px-4 py-3 font-mono text-[14px] whitespace-pre-wrap text-[#e2e8f0]">
            {frame.output}
            <span className="ml-0.5 inline-block h-4 w-2 translate-y-0.5 animate-pulse bg-[#94a3b8]" />
          </pre>
        </div>
      </div>

      {/* Commandes */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Button variant="outline" size="sm" onClick={() => go(i - 1)} disabled={i === 0}>
          <ChevronLeft aria-hidden /> Précédent
        </Button>
        <Button
          variant="soft"
          size="sm"
          onClick={() => {
            interact();
            setPlaying((p) => !p);
          }}
          aria-pressed={playing}
        >
          {playing ? <Pause aria-hidden /> : <Play aria-hidden />}
          {playing ? "Pause" : "Lecture"}
        </Button>
        <Button variant="outline" size="sm" onClick={() => go(i + 1)} disabled={i >= last}>
          Suivant <ChevronRight aria-hidden />
        </Button>
        <Button variant="ghost" size="sm" onClick={() => go(0)}>
          <RotateCcw aria-hidden /> Revoir depuis le début
        </Button>
        <div className="ml-auto flex flex-wrap gap-1" aria-hidden>
          {frames.map((_, k) => (
            <button
              key={k}
              type="button"
              tabIndex={-1}
              onClick={() => go(k)}
              className={cn(
                "h-2 rounded-full transition-all",
                k === i ? "w-6 bg-primary" : k < i ? "w-2 bg-primary/40" : "w-2 bg-line",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
