"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";
import { PASS_MARK, type HistogramBin } from "@/domain/statistics";
import { cn } from "@/lib/utils";
import { fmtPercent, fmtScore, SIGNAL_LABELS } from "../labels";
import type { ResultQuestion } from "../types";

const PLOT_H = 168;

function niceMax(n: number) {
  if (n <= 4) return Math.max(1, n);
  const step = n <= 10 ? 2 : n <= 25 ? 5 : 10;
  return Math.ceil(n / step) * step;
}

function Gridlines({ max, format }: { max: number; format: (v: number) => string }) {
  const ticks = [0, max / 2, max];
  return (
    <>
      {ticks.map((t) => (
        <div
          key={t}
          className="pointer-events-none absolute right-0 left-8 border-t border-line-soft"
          style={{ bottom: (t / max) * PLOT_H }}
        >
          <span className="absolute -top-2 -left-8 w-6 text-right text-[11px] text-muted tabular-nums">
            {format(t)}
          </span>
        </div>
      ))}
    </>
  );
}

/** Répartition des notes sur 20 (tranches de 2 points). */
export function ScoreHistogram({ bins, mean }: { bins: HistogramBin[]; mean: number | null }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...bins.map((b) => b.count)));
  const total = bins.reduce((s, b) => s + b.count, 0);

  return (
    <figure className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-display text-lg font-bold">Répartition des notes</span>
        <span className="text-xs text-muted">copies notées : {total}</span>
      </figcaption>
      {total === 0 ? (
        <p className="py-14 text-center text-sm text-muted">
          Aucune copie notée pour l&apos;instant.
        </p>
      ) : (
        <div className="relative pt-6" style={{ height: PLOT_H + 52 }}>
          <div className="absolute inset-x-0 top-6" style={{ height: PLOT_H }}>
            <Gridlines max={max} format={(v) => String(Math.round(v))} />
            <div className="absolute inset-y-0 right-0 left-8 flex items-end gap-0.5">
              {bins.map((b, i) => {
                const h = b.count === 0 ? 0 : Math.max(3, (b.count / max) * PLOT_H);
                return (
                  <div
                    key={b.from}
                    className="relative flex h-full flex-1 items-end"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    tabIndex={0}
                    aria-label={`${b.from} à ${b.to} : ${b.count} copie${b.count > 1 ? "s" : ""}`}
                  >
                    <div
                      className={cn(
                        "w-full rounded-t-[4px] transition-colors",
                        b.from < PASS_MARK ? "bg-[#7480f5]" : "bg-primary-strong",
                        hover === i && "brightness-90",
                      )}
                      style={{ height: h }}
                    />
                    {hover === i ? (
                      <div className="absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-field bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-soft">
                        <strong>
                          {b.from} – {b.to}
                        </strong>{" "}
                        · {b.count} copie{b.count > 1 ? "s" : ""}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {/* Seuil de réussite et moyenne */}
            <Marker at={PASS_MARK} label="10" dashed />
            {mean !== null ? <Marker at={mean} label={`moy. ${fmtScore(mean)}`} /> : null}
          </div>
          <div className="absolute inset-x-0 bottom-0 left-8 flex justify-between text-[11px] text-muted tabular-nums">
            {[0, 4, 8, 12, 16, 20].map((v) => (
              <span key={v}>{v}</span>
            ))}
          </div>
        </div>
      )}
      <p className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-[#7480f5]" aria-hidden /> sous 10
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-sm bg-primary-strong" aria-hidden /> 10 et plus
        </span>
      </p>
    </figure>
  );
}

function Marker({ at, label, dashed }: { at: number; label: string; dashed?: boolean }) {
  const left = `calc(2rem + (100% - 2rem) * ${Math.min(20, Math.max(0, at)) / 20})`;
  return (
    <div className="pointer-events-none absolute inset-y-0" style={{ left }}>
      <div
        className={cn(
          "absolute inset-y-0 w-0 border-l-2",
          dashed ? "border-dashed border-muted/60" : "border-ink",
        )}
      />
      <span
        className={cn(
          "absolute -top-5 -translate-x-1/2 rounded-full px-1.5 text-[11px] font-bold whitespace-nowrap",
          dashed ? "text-muted" : "bg-ink text-white",
        )}
      >
        {label}
      </span>
    </div>
  );
}

/** Taux de réussite de chaque question ; clic = ouvrir l'analyse de la question. */
export function SuccessByQuestion({
  questions,
  onOpen,
}: {
  questions: ResultQuestion[];
  onOpen: (examQuestionId: string) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const labelEvery = questions.length > 30 ? 5 : questions.length > 15 ? 2 : 1;
  const hasData = questions.some((q) => q.analysis.responses > 0);

  return (
    <figure className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="font-display text-lg font-bold">Réussite par question</span>
        <span className="text-xs text-muted">cliquez une barre pour l&apos;analyse</span>
      </figcaption>
      {!hasData ? (
        <p className="py-14 text-center text-sm text-muted">
          Aucune copie notée pour l&apos;instant.
        </p>
      ) : (
        <div className="relative pt-6" style={{ height: PLOT_H + 52 }}>
          <div className="absolute inset-x-0 top-6" style={{ height: PLOT_H }}>
            <Gridlines max={1} format={(v) => `${Math.round(v * 100)}%`} />
            <div className="absolute inset-y-0 right-0 left-8 flex items-end gap-0.5">
              {questions.map((q, i) => {
                const rate = q.analysis.successRate ?? 0;
                const flagged = q.analysis.signals.length > 0 && !q.neutralized;
                return (
                  <button
                    key={q.examQuestionId}
                    type="button"
                    className="relative flex h-full min-w-0 flex-1 cursor-pointer items-end"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    onClick={() => onOpen(q.examQuestionId)}
                    aria-label={`Question ${q.number} : ${fmtPercent(q.analysis.successRate)} de réussite`}
                  >
                    <div
                      className={cn(
                        "w-full rounded-t-[4px]",
                        q.neutralized
                          ? "bg-[repeating-linear-gradient(45deg,#c9cfde_0_3px,#eef0f5_3px_6px)]"
                          : "bg-primary",
                        hover === i && "brightness-90",
                      )}
                      style={{ height: q.neutralized ? PLOT_H : Math.max(3, rate * PLOT_H) }}
                    />
                    {flagged ? (
                      <AlertTriangle
                        className="absolute left-1/2 size-3.5 -translate-x-1/2 text-warning"
                        style={{ bottom: Math.max(3, rate * PLOT_H) + 4 }}
                        aria-hidden
                      />
                    ) : null}
                    {hover === i ? (
                      <div className="absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 rounded-field bg-ink px-2.5 py-1.5 text-left text-xs whitespace-nowrap text-white shadow-soft">
                        <strong>Q{q.number}</strong> ·{" "}
                        {q.neutralized
                          ? "neutralisée"
                          : `${fmtPercent(q.analysis.successRate)} (${q.analysis.correct}/${q.analysis.responses})`}
                        {flagged ? (
                          <span className="block text-[#ffd59e]">
                            {q.analysis.signals.map((s) => SIGNAL_LABELS[s]).join(" · ")}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 left-8 flex gap-0.5 text-[11px] text-muted tabular-nums">
            {questions.map((q, i) => (
              <span key={q.examQuestionId} className="min-w-0 flex-1 text-center">
                {i % labelEvery === 0 ? q.number : ""}
              </span>
            ))}
          </div>
        </div>
      )}
      <p className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <AlertTriangle className="size-3.5 text-warning" aria-hidden /> question à vérifier
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="size-2.5 rounded-sm bg-[repeating-linear-gradient(45deg,#c9cfde_0_2px,#eef0f5_2px_4px)]"
            aria-hidden
          />{" "}
          neutralisée
        </span>
      </p>
    </figure>
  );
}
