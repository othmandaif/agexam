"use client";

import Link from "next/link";
import { paths } from "@/lib/routes";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Clock, Undo2, X } from "lucide-react";
import { useTransition } from "react";
import { ProgressStrip } from "@/components/exam/progress-strip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { APP_TIMEZONE } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
  CALM_EVENTS,
  EVENT_LABELS,
  formatAgo,
  formatRemaining,
  LIVE_STATUS_LABELS,
  LIVE_STATUS_TONE,
  SANCTION_LABELS,
  SANCTION_TONE,
} from "../labels";
import { addTimeAction, cancelSanctionAction } from "../server/actions";
import type { MonitorStudent, TimelineIncident } from "../types";
import { monitorApi, monitorKeys } from "./api";

const clock = new Intl.DateTimeFormat("fr-FR", {
  timeZone: APP_TIMEZONE,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});
const at = (iso: string) => clock.format(new Date(iso));

const EXTRA_TIME = [
  { seconds: 30, label: "+30 s" },
  { seconds: 60, label: "+1 min" },
  { seconds: 120, label: "+2 min" },
  { seconds: 300, label: "+5 min" },
];

/** Détail d'un étudiant : actions du formateur, sanctions, journal. */
export function StudentPanel({
  examId,
  student,
  serverNow,
  onClose,
  onDone,
}: {
  examId: string;
  student: MonitorStudent;
  serverNow: string;
  onClose: () => void;
  onDone: (state: ActionState<unknown>) => void;
}) {
  const queryClient = useQueryClient();
  const attemptId = student.attemptId;
  const timeline = useQuery({
    queryKey: monitorKeys.timeline(examId, attemptId ?? "none"),
    queryFn: () => monitorApi.timeline(examId, attemptId!),
    enabled: !!attemptId,
    staleTime: 0,
    refetchInterval: 5_000,
  });
  const [pending, start] = useTransition();

  const run = (action: () => Promise<ActionState<unknown>>) =>
    start(async () => {
      onDone(await action());
      if (attemptId) {
        await queryClient.invalidateQueries({ queryKey: monitorKeys.timeline(examId, attemptId) });
      }
    });

  const active = student.status === "IN_PROGRESS" || student.status === "OFFLINE";
  const remaining = active ? formatRemaining(student.currentExpiresAt, serverNow) : null;

  return (
    <section className="flex flex-col rounded-card border border-line bg-surface">
      <header className="flex items-start justify-between gap-3 border-b border-line-soft px-4 py-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="truncate font-display text-lg font-bold">{student.fullName}</h2>
          <span className="truncate text-xs text-muted">{student.email}</span>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge tone={LIVE_STATUS_TONE[student.status]}>
              {LIVE_STATUS_LABELS[student.status]}
            </Badge>
            {student.flagged ? <Badge tone="danger">À revoir</Badge> : null}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-muted hover:bg-canvas"
          aria-label="Fermer le détail"
        >
          <X className="size-5" />
        </button>
      </header>

      <div className="flex flex-col gap-4 px-4 py-4">
        {student.total > 0 ? (
          <div className="flex flex-col gap-2">
            <ProgressStrip cells={student.cells} />
            <dl className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Répondues" value={`${student.answered}/${student.total}`} />
              <Stat
                label="Violations"
                value={String(student.violationCount)}
                danger={student.violationCount > 0}
              />
              <Stat
                label={active ? "Vu il y a" : "Note"}
                value={
                  active
                    ? formatAgo(student.lastSeenAt, serverNow)
                    : student.scoreOutOf20 !== null
                      ? `${student.scoreOutOf20.toFixed(2).replace(".", ",")}`
                      : "—"
                }
              />
            </dl>
          </div>
        ) : (
          <p className="text-sm text-muted">
            L&apos;étudiant n&apos;a pas encore commencé l&apos;examen.
          </p>
        )}

        {!active && attemptId && student.total > 0 ? (
          <Link
            href={paths.examCopy(examId, attemptId)}
            className="flex items-center justify-center gap-2 rounded-field bg-primary px-3 py-2.5 text-sm font-semibold text-white no-underline hover:bg-primary-strong"
          >
            Voir, corriger et rendre la copie →
          </Link>
        ) : null}

        {active && student.currentNumber && attemptId ? (
          <div className="flex flex-col gap-2 rounded-field bg-canvas p-3">
            <p className="flex items-center gap-1.5 text-sm">
              <Clock className="size-4 text-muted" aria-hidden />
              Question {student.currentNumber}
              {remaining ? (
                <>
                  {" · "}
                  reste <strong className="tabular-nums">{remaining}</strong>
                </>
              ) : null}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {EXTRA_TIME.map((t) => (
                <Button
                  key={t.seconds}
                  variant="soft"
                  className="bg-surface"
                  size="sm"
                  disabled={pending}
                  onClick={() => run(() => addTimeAction(attemptId, t.seconds))}
                >
                  {t.label}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted">
              Temps ajouté à la question en cours (souci technique, poste lent…).
            </p>
          </div>
        ) : null}

        {attemptId ? (
          timeline.isPending ? (
            <p className="text-sm text-muted">Chargement du journal…</p>
          ) : timeline.isError ? (
            <p className="text-sm text-danger">{timeline.error.message}</p>
          ) : (
            <>
              <IncidentList
                incidents={timeline.data.incidents}
                pending={pending}
                onRevoke={(i) => {
                  const warning =
                    i.sanction === "SOUMISSION_AUTO"
                      ? "Annuler cette sanction ? Si l'examen est encore ouvert, l'étudiant pourra reprendre là où il s'était arrêté."
                      : "Annuler cette sanction ? La violation ne sera plus comptée.";
                  if (window.confirm(warning)) run(() => cancelSanctionAction(i.id));
                }}
              />
              <section className="flex flex-col gap-2">
                <h3 className="text-xs font-bold tracking-wide text-muted uppercase">Journal</h3>
                {timeline.data.events.length === 0 ? (
                  <p className="text-sm text-muted">Aucun événement : examen passé sans sortie.</p>
                ) : (
                  <ol className="flex max-h-72 flex-col overflow-y-auto">
                    {timeline.data.events.map((e) => (
                      <li
                        key={e.id}
                        className={cn(
                          "flex items-baseline gap-3 border-l-2 py-1 pl-3 text-sm",
                          CALM_EVENTS.has(e.type)
                            ? "border-line text-muted"
                            : e.incidentId
                              ? "border-danger-fill font-semibold"
                              : "border-warning-fill",
                        )}
                      >
                        <span className="w-16 shrink-0 font-mono text-xs text-muted tabular-nums">
                          {at(e.at)}
                        </span>
                        <span className="flex-1">
                          {EVENT_LABELS[e.type]}
                          {e.questionNumber ? (
                            <span className="text-muted"> · Q{e.questionNumber}</span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </section>
            </>
          )
        ) : null}
      </div>
    </section>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex flex-col rounded-field bg-canvas px-2 py-2">
      <dt className="text-[11px] font-bold tracking-wide text-muted uppercase">{label}</dt>
      <dd className={cn("font-display text-lg font-bold tabular-nums", danger && "text-danger")}>
        {value}
      </dd>
    </div>
  );
}

function IncidentList({
  incidents,
  pending,
  onRevoke,
}: {
  incidents: TimelineIncident[];
  pending: boolean;
  onRevoke: (incident: TimelineIncident) => void;
}) {
  if (incidents.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-xs font-bold tracking-wide text-muted uppercase">Sanctions</h3>
      <ul className="flex flex-col gap-2">
        {incidents.map((i) => (
          <li
            key={i.id}
            className={cn(
              "flex items-center gap-3 rounded-field border px-3 py-2",
              i.revokedAt ? "border-line-soft opacity-60" : "border-line",
            )}
          >
            <AlertTriangle
              className={cn(
                "size-4 shrink-0",
                i.revokedAt
                  ? "text-muted"
                  : SANCTION_TONE[i.sanction] === "danger"
                    ? "text-danger"
                    : "text-warning",
              )}
              aria-hidden
            />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className={cn("text-sm font-bold", i.revokedAt && "line-through")}>
                {SANCTION_LABELS[i.sanction]}
              </span>
              <span className="text-xs text-muted">
                Violation n° {i.violationNumber}
                {i.questionNumber ? ` · Q${i.questionNumber}` : ""} · {at(i.startedAt)}
                {i.revokedAt ? " · annulée" : ""}
              </span>
            </span>
            {!i.revokedAt ? (
              <Button variant="ghost" size="sm" disabled={pending} onClick={() => onRevoke(i)}>
                <Undo2 aria-hidden />
                Annuler
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
