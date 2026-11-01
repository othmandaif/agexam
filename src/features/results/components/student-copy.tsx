import { AlertTriangle, Check, Clock, X } from "lucide-react";
import { CodeBlock } from "@/components/exam/code-block";
import { Badge } from "@/components/ui/badge";
import { EVENT_LABELS, SANCTION_LABELS } from "@/features/monitoring/labels";
import type { AttemptTimeline } from "@/features/monitoring/types";
import { formatDateTime, formatTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { FreeAnswer } from "@/components/exam/free-answer";
import { AlgoGradePanel } from "../client/algo-grade-panel";
import { CopyActions } from "../client/copy-actions";
import {
  fmtScore,
  fmtSeconds,
  QUESTION_STATUS_LABELS,
  RESULT_STATUS_LABELS,
  RESULT_STATUS_TONE,
} from "../labels";
import { VERDICT_LABEL } from "../labels";
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
  if (!answered(q)) return { label: "Sans réponse", tone: "warning" };
  if (q.algo) {
    const g = q.algo.grading;
    if (!g || g.status === "pending" || g.status === "running")
      return { label: "Correction en cours", tone: "neutral" };
    if (g.status === "failed") return { label: "À corriger", tone: "warning" };
    if (g.status === "proposed") return { label: "Note proposée, à valider", tone: "warning" };
  }
  if (q.isCorrect) return { label: "Juste", tone: "success" };
  if ((q.pointsAwarded ?? 0) > 0) return { label: "Partiellement juste", tone: "warning" };
  return { label: "Faux", tone: "danger" };
}

const answered = (q: CopyQuestion) =>
  q.algo ? !!q.algo.code?.trim() : q.selectedOptionIds.length > 0;

const SOURCE_LABEL = {
  auto: "Correction automatique (jeux d'essai + relecture)",
  tests: "Correction automatique (jeux d'essai)",
  manual: "Note du formateur",
} as const;

/** Copie complète d'un étudiant, vue formateur (bonnes réponses, temps, incidents). */
export function StudentCopyView({
  copy,
  timeline,
}: {
  copy: StudentCopy;
  timeline: AttemptTimeline | null;
}) {
  const firstAlgoId = copy.questions.find((q) => q.algo)?.attemptQuestionId ?? null;
  const counted = copy.questions.filter((q) => !q.examNeutralized && q.status !== "NEUTRALISEE");
  const counts = {
    correct: counted.filter((q) => q.isCorrect).length,
    wrong: counted.filter((q) => q.isCorrect === false && answered(q) && q.status !== "INVALIDEE")
      .length,
    blank: counted.filter((q) => !answered(q) && q.status !== "INVALIDEE").length,
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
            released={copy.released}
            toValidate={copy.toValidate}
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
              id={q.algo && q.attemptQuestionId === firstAlgoId ? "algo" : undefined}
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
              {q.code && !q.algo ? (
                <CodeBlock code={q.code} language={q.codeLanguage ?? "PSEUDO_CODE"} fontSize={13} />
              ) : null}
              {q.algo ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-bold text-muted">
                      {q.algo.kind === "texte"
                        ? "Réponse de l'étudiant"
                        : "Algorithme de l'étudiant"}
                    </span>
                    <FreeAnswer text={q.algo.code} kind={q.algo.kind} />
                  </div>
                  {(() => {
                    const g = q.algo.grading;
                    if (!answered(q) && !g) return null;
                    if (!g || g.status === "pending" || g.status === "running")
                      return (
                        <p className="rounded-field border border-line-soft bg-canvas px-3 py-2.5 text-sm text-muted">
                          Correction en cours… Rechargez la page dans quelques secondes, ou utilisez
                          « Relancer la correction » si elle n&apos;aboutit pas.
                        </p>
                      );
                    if (g.status === "failed")
                      return (
                        <p className="rounded-field border border-warning/30 bg-warning-bg px-3 py-2.5 text-sm text-ink">
                          La correction automatique n&apos;a pas abouti
                          {g.reviewError ? ` (${g.reviewError})` : ""}. Relancez-la ou notez
                          manuellement.
                        </p>
                      );
                    return (
                      <div className="rounded-field border border-line-soft bg-canvas px-3 py-2.5 text-sm">
                        <p className="font-semibold text-ink">
                          {SOURCE_LABEL[g.source ?? "tests"]}
                          {g.status === "proposed" ? (
                            <span className="text-warning">
                              {" "}
                              · proposition :{" "}
                              {fmtScore(Math.round((g.ratio ?? 0) * q.points * 100) / 100)} /{" "}
                              {fmtScore(q.points)} pt (à valider)
                            </span>
                          ) : null}
                          {g.testsTotal ? (
                            <span className="font-normal text-muted">
                              {" "}
                              · {g.testsPassed} / {g.testsTotal} jeux d&apos;essai réussis
                            </span>
                          ) : null}
                        </p>
                        {g.verdict ? (
                          <p className="mt-1 text-[13px]">
                            <span className="font-semibold text-muted">Verdict : </span>
                            <span className="font-bold text-ink">{VERDICT_LABEL[g.verdict]}</span>
                          </p>
                        ) : null}
                        {g.comment ? <p className="mt-1 text-ink-soft">{g.comment}</p> : null}
                        {g.analysis ? (
                          <details className="mt-2 rounded-field border border-line-soft bg-surface px-3 py-2">
                            <summary className="cursor-pointer text-[13px] font-semibold text-primary">
                              Analyse détaillée de la copie (visible par vous seul)
                            </summary>
                            <div className="mt-1.5 flex flex-col gap-1 text-[13px] text-ink-soft">
                              {g.analysis.split("\n").map((line, i) => (
                                <p key={i}>{line}</p>
                              ))}
                            </div>
                          </details>
                        ) : null}
                        {g.criteria?.length ? (
                          <table className="mt-2 w-full text-[13px]">
                            <caption className="sr-only">Détail de la note par critère</caption>
                            <tbody>
                              {g.criteria.map((c) => (
                                <tr key={c.key} className="border-t border-line-soft align-top">
                                  <td className="py-1.5 pr-3 font-semibold whitespace-nowrap">
                                    {c.label}
                                  </td>
                                  <td className="py-1.5 pr-3 text-right font-bold whitespace-nowrap tabular-nums">
                                    {fmtScore(Math.round(c.score * q.points * 100) / 100)} /{" "}
                                    {fmtScore(Math.round(c.max * q.points * 100) / 100)}
                                  </td>
                                  <td className="py-1.5 text-muted">{c.note}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : null}
                        {g.reviewSource === "bareme" ? (
                          <p className="mt-2 text-xs text-warning">
                            Relecture DeepSeek indisponible
                            {g.reviewError ? ` (${g.reviewError})` : ""} : note calculée sur le
                            barème, à vérifier.
                          </p>
                        ) : null}
                      </div>
                    );
                  })()}
                  {q.status !== "INVALIDEE" && !q.examNeutralized && q.status !== "A_VENIR" ? (
                    <AlgoGradePanel
                      attemptQuestionId={q.attemptQuestionId}
                      points={q.points}
                      current={q.pointsAwarded}
                      canRegrade={answered(q)}
                      proposed={
                        q.algo.grading?.status === "proposed"
                          ? Math.round((q.algo.grading.ratio ?? 0) * q.points * 100) / 100
                          : null
                      }
                    />
                  ) : null}
                  <details className="text-sm print:hidden">
                    <summary className="cursor-pointer font-semibold text-muted">
                      {q.algo.kind === "texte" ? "Voir la réponse attendue" : "Voir le corrigé"}
                    </summary>
                    <div className="mt-2">
                      <FreeAnswer text={q.algo.solution} kind={q.algo.kind} />
                    </div>
                  </details>
                </div>
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
