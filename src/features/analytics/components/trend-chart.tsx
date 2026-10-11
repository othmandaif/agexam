"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface TrendSeries {
  name: string;
  /** Une valeur par point de l'axe X (null = pas de note). */
  values: (number | null)[];
  /** Classe Tailwind de couleur de fond (point, légende) et couleur CSS du trait. */
  dotClass: string;
  stroke: string;
  dashed?: boolean;
}

const H = 220;
const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");

/**
 * Courbe de notes sur 20 (un point par examen), avec la ligne de réussite à 10.
 * Survol / focus : infobulle avec toutes les séries du point.
 */
export function TrendChart({
  labels,
  details,
  series,
  emptyText = "Pas encore de note.",
}: {
  labels: string[];
  /** Ligne secondaire de l'infobulle (titre de l'examen…). */
  details?: string[];
  series: TrendSeries[];
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = labels.length;
  const hasData = series.some((s) => s.values.some((v) => v !== null));
  if (n === 0 || !hasData) {
    return <p className="py-16 text-center text-sm text-muted">{emptyText}</p>;
  }
  const x = (i: number) => (n === 1 ? 50 : 4 + (i / (n - 1)) * 92);
  const y = (v: number) => 100 - (v / 20) * 100;
  const labelEvery = Math.max(1, Math.ceil(n / 8));

  return (
    <div className="flex flex-col gap-2">
      <div className="relative ml-8" style={{ height: H }}>
        {/* Grille */}
        {[0, 5, 10, 15, 20].map((t) => (
          <div
            key={t}
            className={cn(
              "absolute inset-x-0 border-t",
              t === 10 ? "border-dashed border-muted/50" : "border-line-soft",
            )}
            style={{ top: `${y(t)}%` }}
          >
            <span className="absolute -top-2 -left-8 w-6 text-right text-[11px] text-muted tabular-nums">
              {t}
            </span>
          </div>
        ))}
        {/* Traits */}
        <svg
          className="absolute inset-0 h-full w-full overflow-visible"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
        >
          {series.map((s) => {
            const pts = s.values
              .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
              .filter(Boolean)
              .join(" ");
            return (
              <polyline
                key={s.name}
                points={pts}
                fill="none"
                stroke={s.stroke}
                strokeWidth={2}
                strokeDasharray={s.dashed ? "5 4" : undefined}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            );
          })}
        </svg>
        {/* Points */}
        {series.map((s) =>
          s.values.map((v, i) =>
            v === null ? null : (
              <span
                key={`${s.name}-${i}`}
                className={cn(
                  "pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface",
                  s.dotClass,
                  hover === i && "size-3.5",
                )}
                style={{ left: `${x(i)}%`, top: `${y(v)}%` }}
              />
            ),
          ),
        )}
        {/* Zones de survol */}
        {labels.map((label, i) => {
          const left = n === 1 ? 0 : i === 0 ? 0 : (x(i - 1) + x(i)) / 2;
          const right = n === 1 ? 100 : i === n - 1 ? 100 : (x(i) + x(i + 1)) / 2;
          return (
            <button
              key={i}
              type="button"
              className="absolute inset-y-0 cursor-default outline-none"
              style={{ left: `${left}%`, width: `${right - left}%` }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${label} : ${series
                .map((s) => `${s.name} ${s.values[i] === null ? "—" : fmt(s.values[i]!)}`)
                .join(", ")}`}
            />
          );
        })}
        {hover !== null ? (
          <>
            <div
              className="pointer-events-none absolute inset-y-0 border-l border-ink/30"
              style={{ left: `${x(hover)}%` }}
            />
            <div
              className={cn(
                "pointer-events-none absolute top-0 z-10 rounded-field bg-ink px-3 py-2 text-xs whitespace-nowrap text-white shadow-soft",
                x(hover) > 60 ? "-translate-x-[calc(100%+8px)]" : "translate-x-2",
              )}
              style={{ left: `${x(hover)}%` }}
            >
              <div className="font-bold">{labels[hover]}</div>
              {details?.[hover] ? <div className="text-white/70">{details[hover]}</div> : null}
              {series.map((s) => (
                <div key={s.name} className="mt-1 flex items-center gap-2">
                  <span className={cn("size-2 rounded-full", s.dotClass)} aria-hidden />
                  {s.name} :{" "}
                  <strong>{s.values[hover] === null ? "—" : `${fmt(s.values[hover]!)}/20`}</strong>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
      {/* Axe X */}
      <div className="relative ml-8 h-4 text-[11px] text-muted">
        {labels.map((l, i) =>
          i % labelEvery === 0 || i === n - 1 ? (
            <span
              key={i}
              className="absolute -translate-x-1/2 whitespace-nowrap tabular-nums"
              style={{ left: `${x(i)}%` }}
            >
              {l}
            </span>
          ) : null,
        )}
      </div>
      {series.length > 1 ? (
        <div className="ml-8 flex flex-wrap gap-4 text-xs text-muted">
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1.5">
              <span
                className={cn("h-0.5 w-4", s.dashed ? "border-t-2 border-dashed" : s.dotClass)}
                style={s.dashed ? { borderColor: s.stroke } : undefined}
                aria-hidden
              />
              {s.name}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t border-dashed border-muted" aria-hidden /> seuil 10
          </span>
        </div>
      ) : null}
    </div>
  );
}

/** Mini-courbe (tableau des étudiants). */
export function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) {
    return <span className="text-xs text-muted">{values.length ? "1 note" : "—"}</span>;
  }
  const w = 72;
  const h = 22;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * w},${h - (v / 20) * h}`)
    .join(" ");
  const last = values[values.length - 1]!;
  return (
    <svg width={w} height={h} className="overflow-visible" aria-hidden>
      <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="#d9dde8" strokeDasharray="2 2" />
      <polyline
        points={pts}
        fill="none"
        stroke="#4255ff"
        strokeWidth={1.75}
        strokeLinejoin="round"
      />
      <circle cx={w} cy={h - (last / 20) * h} r={2.5} fill="#4255ff" />
    </svg>
  );
}
