import { AlertTriangle, Check, Clock, X } from "lucide-react";
import { CodeBlock } from "@/components/exam/code-block";
import { Badge } from "@/components/ui/badge";
import { EVENT_LABELS, SANCTION_LABELS } from "@/features/monitoring/labels";
import type { AttemptTimeline } from "@/features/monitoring/types";
import { formatDateTime, formatTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { CopyActions } from "../client/copy-actions";
import {
  fmtScore,
  fmtSeconds,
  QUESTION_STATUS_LABELS,
  RESULT_STATUS_LABELS,
  RESULT_STATUS_TONE,
} from "../labels";
import type { CopyQuestion, StudentCopy } from "../types";

const letter = (i: number) => String.fromCharCode(65 + i);

function verdict(q: CopyQuestion): {
  label: string;
  tone: "success" | "danger" | "neutral" | "warning";
} {
  if (q.examNeutralized) return { label: "Neutralisée (examen)", tone: "neutral" };
  if (q.status === "NEUTRALISEE") return { label: "Neutralisée (réseau)", tone: "neutral" };
  if (q.status === "INVALIDEE") return { label: "Invalidée (sanction)", tone: "danger" };
  if (q.status === "A_VENIR") return { label: "Non vue", tone: "neutral" };
  if (q.selectedOptionIds.length === 0) return { label: "Sans réponse", tone: "warning" };
  return q.isCorrect ? { label: "Juste", tone: "success" } : { label: "Faux", tone: "danger" };
}

/** Copie complète d'un étudiant, vue formateur (bonnes réponses, temps, incidents). */
export function StudentCopyView({
  copy,
  timeline,
}: {
  copy: StudentCopy;
  timeline: AttemptTimeline | null;
}) {
  const counted = copy.questions.filter((q) => !q.examNeutralized && q.status !== "NEUTRALISEE");
  const counts = {
    correct: counted.filter((q) => q.isCorrect).length,
    wrong: counted.filter(
      (q) => q.isCorrect === false && q.selectedOptionIds.length > 0 && q.status !== "INVALIDEE",
    ).length,
    blank: counted.filter((q) => q.selectedOptionIds.length === 0 && q.status !== "INVALIDEE")
      .length,
    invalidated: counted.filter((q) => q.status === "INVALIDEE").length,
  };
  const duration =
    copy.submittedAt !== null
      ? Math.round((Date.parse(copy.submittedAt) - Date.parse(copy.startedAt)) / 1000)
      : null;

  return (
    <>
      <section className="grid gap-x-6 gap-y-4 rounded-card border border-line bg-surface p-5 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
        <div className="flex flex-col items-center justify-center rounded-card bg-primary-wash px-6 py-4 text-center">
          <span className="text-xs font-bold tracking-wide text-muted uppercase">Note</span>
          <span className="font-display text-4xl font-bold text-primary-strong tabular-nums">
            {copy.scoreOutOf20 !== null && copy.status !== "EN_COURS"
              ? fmtScore(copy.scoreOutOf20)
              : "—"}
            <span className="text-lg text-muted">/20</span>
          </span>
          {copy.scoreAwarded !== null && copy.scoreMax !== null && copy.status !== "EN_COURS" ? (
            <span className="text-xs text-muted">
              {fmtScore(copy.scoreAwarded)} / {fmtScore(copy.scoreMax)} pts
            </span>
          ) : null}
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm lg:grid-cols-4">
          <Info label="Statut">
            <span className="inline-flex flex-wrap gap-1.5">
              <Badge tone={RESULT_STATUS_TONE[copy.status]}>
                {RESULT_STATUS_LABELS[copy.status]}
              </Badge>
              {copy.flagged ? <Badge tone="danger">À revoir</Badge> : null}
            </span>
          </Info>
          <Info label="Réponses">
            <span className="text-success">{counts.correct} justes</span> ·{" "}
            <span className="text-danger">{counts.wrong} fausses</span> · {counts.blank} vides
            {counts.invalidated ? ` · ${counts.invalidated} invalidées` : ""}
          </Info>
          <Info label="Début → fin">
            {formatDateTime(new Date(copy.startedAt))}
            {copy.submittedAt ? ` → ${formatTime(new Date(copy.submittedAt))}` : ""}
            {duration !== null ? (
              <span className="text-muted"> ({fmtSeconds(duration)})</span>
            ) : null}
          </Info>
          <Info label="Sécurité">
            {copy.violationCount} sortie{copy.violationCount > 1 ? "s" : ""}
            {copy.neutralizations
              ? ` · ${copy.neutralizations} coupure${copy.neutralizations > 1 ? "s" : ""}`
              : ""}
            {copy.receiptCode ? (
              <span className="block font-mono text-xs text-muted">Reçu {copy.receiptCode}</span>
            ) : null}
          </Info>
        </dl>
        <div className="flex justify-end border-t border-line-soft pt-4 md:col-span-2">
          <CopyActions
            attemptId={copy.attemptId}
            status={copy.status}
            flagged={copy.flagged}
            studentName={copy.student.fullName}
          />
        </div>
      </section>

      {timeline && timeline.incidents.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-5">
          <h2 className="font-display text-lg font-bold">Incidents de surveillance</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {timeline.incidents.map((i) => (
              <li
                key={i.id}
                className={cn("flex items-center gap-2", i.revokedAt && "text-muted line-through")}
              >
                <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
                <span className="font-semibold">{SANCTION_LABELS[i.sanction]}</span>
                <span className="text-muted">
                  · violation n° {i.violationNumber}
                  {i.questionNumber ? ` · Q${i.questionNumber}` : ""} ·{" "}
                  {formatTime(new Date(i.startedAt))}
                  {i.revokedAt ? " · annulée" : ""}
                </span>
              </li>
            ))}
          </ul>
          {timeline.events.length ? (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-primary">
                Journal complet ({timeline.events.length} événements)
              </summary>
              <ol className="mt-2 flex flex-col gap-1">
                {timeline.events.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span className="w-14 font-mono text-xs text-muted">
                      {formatTime(new Date(e.at))}
                    </span>
                    {EVENT_LABELS[e.type]}
                    {e.questionNumber ? (
                      <span className="text-muted">· Q{e.questionNumber}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </section>
      ) : null}

      <section className="flex flex-col gap-4">
        <h2 className="font-display text-xl font-bold">
          Questions{" "}
          <span className="text-base font-semibold text-muted">
            dans l&apos;ordre vu par l&apos;étudiant
          </span>
        </h2>
        {copy.questions.map((q) => {
          const v = verdict(q);
          return (
            <article
              key={q.attemptQuestionId}
              className="flex break-inside-avoid flex-col gap-3 rounded-card border border-line bg-surface p-5"
            >
              <header className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-1.5">
                  <span className="text-xs font-bold tracking-wide text-muted uppercase">
                    Question {q.number} · n° {q.referenceNumber} dans l&apos;examen
                  </span>
                  <p className="text-[15px] font-semibold whitespace-pre-line">{q.prompt}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge tone={v.tone}>{v.label}</Badge>
                  <span className="text-sm font-bold tabular-nums">
                    {q.examNeutralized || q.status === "NEUTRALISEE"
                      ? "—"
                      : `${fmtScore(q.pointsAwarded ?? 0)} / ${fmtScore(q.points)} pt`}
                  </span>
                  {q.timeSpentSec !== null ? (
                    <span className="inline-flex items-center gap-1 text-xs text-muted">
                      <Clock className="size-3.5" aria-hidden />
                      {fmtSeconds(q.timeSpentSec)} / {fmtSeconds(q.durationSec)}
                    </span>
                  ) : null}
                </div>
              </header>
              {q.code ? (
                <CodeBlock code={q.code} language={q.codeLanguage ?? "PSEUDO_CODE"} fontSize={13} />
              ) : null}
              <ul className="flex flex-col gap-1.5">
                {q.options.map((o, i) => {
                  const chosen = q.selectedOptionIds.includes(o.id);
                  return (
                    <li
                      key={o.id}
                      className={cn(
                        "flex items-center gap-3 rounded-field border px-3 py-2 text-[15px]",
                        chosen && o.isCorrect && "border-success bg-success-bg",
                        chosen && !o.isCorrect && "border-danger-fill bg-danger-bg",
                        !chosen && o.isCorrect && "border-dashed border-success",
                        !chosen && !o.isCorrect && "border-line-soft",
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold",
                          o.isCorrect
                            ? "bg-success text-white"
                            : chosen
                              ? "bg-danger-fill text-white"
                              : "bg-neutral-bg text-neutral",
                        )}
                      >
                        {o.isCorrect ? (
                          <Check className="size-3.5" aria-hidden />
                        ) : chosen ? (
                          <X className="size-3.5" aria-hidden />
                        ) : (
                          letter(i)
                        )}
                      </span>
                      <span className="flex-1">{o.label}</span>
                      {chosen ? (
                        <span className="text-xs font-bold text-ink-soft">
                          choix de l&apos;étudiant
                        </span>
                      ) : null}
                      {!chosen && o.isCorrect ? (
                        <span className="text-xs font-bold text-success">bonne réponse</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
              {q.status !== "REPONDUE" && q.status !== "EXPIREE" ? (
                <p className="text-xs text-muted">{QUESTION_STATUS_LABELS[q.status]}</p>
              ) : null}
              {q.explanation ? (
                <p className="rounded-field bg-canvas px-3 py-2 text-sm text-muted">
                  <strong className="text-ink">Explication : </strong>
                  {q.explanation}
                </p>
              ) : null}
            </article>
          );
        })}
      </section>
    </>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-bold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="font-semibold">{children}</dd>
    </div>
  );
}
