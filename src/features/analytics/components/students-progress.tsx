"use client";

import { AlertTriangle, Flag } from "lucide-react";
import Link from "next/link";
import { Pagination } from "@/components/ui/pagination";
import { useUrlParams } from "@/lib/use-url-params";
import { PASS_MARK } from "@/domain/statistics";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { fmtNote } from "../labels";
import type { StudentRow } from "../types";
import { TrendBadge } from "./trend-badge";
import { Sparkline } from "./trend-chart";

/**
 * Progression des étudiants : « à suivre » d'abord, lien vers la fiche.
 * Pagination et filtre côté serveur (?suivi=tous|risque&page=&taille=).
 */
export function StudentsProgress({
  rows,
  total,
  atRisk,
  allCount,
  onlyRisk,
  page,
  size,
}: {
  rows: StudentRow[];
  total: number;
  atRisk: number;
  allCount: number;
  onlyRisk: boolean;
  page: number;
  size: number;
}) {
  const { hrefWith, pending } = useUrlParams();

  return (
    <section className="flex flex-col overflow-hidden rounded-card border border-line bg-surface">
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
        <h2 className="font-display text-lg font-bold">Progression des étudiants</h2>
        <div className="flex gap-1.5" role="group" aria-label="Filtrer">
          {[
            { v: true, label: `À suivre (${atRisk})`, param: "risque" },
            { v: false, label: `Tous (${allCount})`, param: "tous" },
          ].map((o) => (
            <Link
              key={o.param}
              href={hrefWith({ suivi: o.param })}
              scroll={false}
              replace
              aria-current={onlyRisk === o.v ? "true" : undefined}
              className={cn(
                "inline-flex h-9 items-center rounded-[10px] px-3 text-[13.5px] font-semibold no-underline transition-colors duration-150",
                onlyRisk === o.v
                  ? "bg-primary-wash text-primary"
                  : "text-muted hover:bg-canvas hover:text-ink",
              )}
            >
              {o.label}
            </Link>
          ))}
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="px-5 pb-6 text-sm text-muted">
          {allCount === 0 ? "Aucune copie notée sur la période." : "Aucun étudiant à suivre."}
        </p>
      ) : (
        <div className={cn("overflow-x-auto transition-opacity", pending && "opacity-60")}>
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-y border-line-soft text-left text-xs font-bold tracking-wide text-muted uppercase">
                <th className="px-5 py-2">Étudiant</th>
                <th className="px-2 py-2">Notes</th>
                <th className="px-2 py-2 text-right">Moyenne</th>
                <th className="px-2 py-2 text-right">Dernière</th>
                <th className="px-2 py-2">Tendance</th>
                <th className="px-2 py-2 text-center">Absences</th>
                <th className="px-5 py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr
                  key={s.studentId}
                  className="border-b border-line-soft last:border-0 hover:bg-primary-wash"
                >
                  <td className="px-5 py-3">
                    <Link
                      href={paths.studentReport(s.studentId)}
                      className="flex items-center gap-1.5 font-bold text-ink no-underline hover:underline"
                    >
                      {s.atRisk ? (
                        <AlertTriangle className="size-4 text-danger" aria-label="À suivre" />
                      ) : null}
                      {s.fullName}
                      {s.flagged ? (
                        <Flag className="size-3.5 text-danger" aria-label="Copie à revoir" />
                      ) : null}
                    </Link>
                    <span className="block text-xs text-muted">{s.groups}</span>
                  </td>
                  <td className="px-2 py-3">
                    <Sparkline values={s.history} />
                  </td>
                  <td
                    className={cn(
                      "px-2 py-3 text-right font-display text-base font-bold tabular-nums",
                      s.mean !== null && s.mean < PASS_MARK && "text-danger",
                    )}
                  >
                    {fmtNote(s.mean)}
                  </td>
                  <td className="px-2 py-3 text-right tabular-nums">{fmtNote(s.last)}</td>
                  <td className="px-2 py-3">
                    {s.count === 0 ? (
                      <span className="text-[13px] font-bold text-danger">Jamais présent</span>
                    ) : (
                      <TrendBadge trend={s.trend} delta={s.delta} />
                    )}
                  </td>
                  <td className="px-2 py-3 text-center tabular-nums">
                    {s.missed > 0 ? (
                      <span className="inline-flex min-w-7 justify-center rounded-full bg-warning-bg px-2 py-0.5 font-bold text-warning">
                        {s.missed}
                      </span>
                    ) : (
                      <span className="text-muted">0</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={paths.studentReport(s.studentId)}
                      className="text-[13px] font-bold whitespace-nowrap text-primary no-underline hover:underline"
                    >
                      Fiche →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination total={total} page={page} size={size} noun="étudiants" />
      <p className="border-t border-line-soft px-5 py-2.5 text-xs text-muted">
        À suivre : moyenne sous 10, baisse de 3 points ou plus (dernière note comparée aux
        précédentes), ou absent à tous les examens.
      </p>
    </section>
  );
}
