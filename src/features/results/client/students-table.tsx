"use client";

import { Download, FileText, Flag, UserRound } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { LocalTime } from "@/components/ui/local-time";
import { Pagination } from "@/components/ui/pagination";
import { RowMenu, type RowMenuItem } from "@/components/ui/row-menu";
import { UrlSearch, UrlSelect } from "@/components/ui/url-filters";
import { PASS_MARK } from "@/domain/statistics";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { fmtScore, RESULT_STATUS_LABELS, RESULT_STATUS_TONE } from "../labels";
import { STUDENT_STATUS_FILTERS } from "../students-filter";
import type { ResultStudent } from "../types";

const AVATAR_TONES = [
  "bg-lilac text-primary",
  "bg-success-bg text-[#18b981]",
  "bg-violet-bg text-violet",
  "bg-orange-bg text-orange",
];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

const tone = (id: string) => {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length]!;
};

/** Page courante des résultats ; filtre, recherche et pagination vivent dans l'URL (serveur). */
export function StudentsTable({
  examId,
  rows,
  total,
  page,
  size,
}: {
  examId: string;
  rows: ResultStudent[];
  total: number;
  page: number;
  size: number;
}) {
  return (
    <section
      id="etudiants"
      className="flex scroll-mt-24 flex-col overflow-hidden rounded-card border border-line bg-surface shadow-soft"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div>
          <h2 className="text-[17px] font-bold">Résultats des étudiants</h2>
          <p className="text-[13px] text-muted">
            {total} étudiant{total > 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2.5 md:w-[520px] md:flex-nowrap">
          <UrlSearch placeholder="Nom, e-mail, groupe…" label="Rechercher un étudiant" />
          <UrlSelect
            param="statut"
            label="Filtrer par statut"
            allLabel="Tous les statuts"
            options={Object.entries(STUDENT_STATUS_FILTERS).map(([value, label]) => ({
              value,
              label,
            }))}
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-muted">Aucun étudiant ne correspond.</p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[820px] text-[14px]">
            <thead>
              <tr className="border-b border-line-soft text-left text-[12px] font-semibold tracking-wide text-muted uppercase">
                <th className="w-14 px-5 py-3 text-center">Rang</th>
                <th className="px-3 py-3">Étudiant</th>
                <th className="px-3 py-3">Statut</th>
                <th className="px-3 py-3 text-right">Note</th>
                <th className="px-3 py-3 text-right">Durée</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => {
                const href = s.attemptId ? paths.examCopy(examId, s.attemptId) : null;
                const passed = s.scoreOutOf20 !== null && s.scoreOutOf20 >= PASS_MARK;
                const items: RowMenuItem[] = [
                  ...(href && s.attemptId
                    ? [
                        { label: "Voir la copie", icon: FileText, href },
                        {
                          label: "Copie PDF",
                          icon: Download,
                          href: paths.examCopyPdf(examId, s.attemptId),
                          download: true,
                        },
                      ]
                    : []),
                  {
                    label: "Fiche étudiant",
                    icon: UserRound,
                    href: paths.studentReport(s.profileId),
                  },
                ];
                return (
                  <tr
                    key={s.profileId}
                    className={cn(
                      "border-b border-line-soft last:border-0 hover:bg-[#f8fafc]",
                      s.status === "ABSENT" && "text-muted",
                    )}
                  >
                    <td className="px-5 py-3 text-center font-semibold text-muted tabular-nums">
                      {s.rank ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-full text-[12.5px] font-bold",
                            tone(s.profileId),
                          )}
                          aria-hidden
                        >
                          {initials(s.fullName)}
                        </span>
                        <span className="flex min-w-0 flex-col">
                          {href ? (
                            <Link
                              href={href}
                              className="font-semibold text-ink no-underline hover:underline"
                            >
                              {s.fullName}
                            </Link>
                          ) : (
                            <span className="font-semibold">{s.fullName}</span>
                          )}
                          <span className="truncate text-[12.5px] text-muted">
                            {s.email}
                            {s.groups ? ` · ${s.groups}` : ""}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        {s.scoreOutOf20 !== null ? (
                          <Badge tone={passed ? "success" : "danger"}>
                            {passed ? "Réussi" : "Échoué"}
                          </Badge>
                        ) : (
                          <Badge tone={RESULT_STATUS_TONE[s.status]}>
                            {RESULT_STATUS_LABELS[s.status]}
                          </Badge>
                        )}
                        {s.flagged ? (
                          <Flag className="size-4 text-danger" aria-label="Copie à revoir" />
                        ) : null}
                        {s.released ? <Badge tone="success">Rendue</Badge> : null}
                        {s.algoToReview > 0 && href ? (
                          <Link href={`${href}#algo`} className="no-underline">
                            <Badge tone="warning">Algo à valider</Badge>
                          </Link>
                        ) : null}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {s.scoreOutOf20 !== null ? (
                        <span
                          className={cn(
                            "font-bold tabular-nums",
                            passed ? "text-ink" : "text-danger",
                          )}
                        >
                          {fmtScore(s.scoreOutOf20)}
                          <span className="text-[12px] font-medium text-muted">/20</span>
                        </span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right text-muted tabular-nums">
                      {s.durationSec === null
                        ? "—"
                        : `${Math.max(1, Math.round(s.durationSec / 60))} min`}
                    </td>
                    <td className="px-3 py-3 text-[13px] whitespace-nowrap text-muted">
                      <LocalTime date={s.submittedAt} withDate />
                    </td>
                    <td className="px-5 py-3 text-right">
                      <RowMenu label={`Actions pour ${s.fullName}`} items={items} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pagination total={total} page={page} size={size} noun="étudiants" />
    </section>
  );
}
