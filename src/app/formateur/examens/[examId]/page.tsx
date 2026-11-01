import {
  Archive,
  BarChart3,
  CalendarClock,
  Copy,
  DoorClosed,
  DoorOpen,
  FileText,
  Pencil,
  Radio,
  RefreshCw,
  Rocket,
  Trash2,
  Undo2,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ExamPhaseBadge } from "@/components/exam/exam-phase-badge";
import { Badge } from "@/components/ui/badge";
import { QuestionCard } from "@/components/exam/question-card";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { InlineAction } from "@/components/ui/inline-action";
import { formatTotalDuration } from "@/domain/duration";
import { canEditContent, examPhase, publishProblems } from "@/domain/exam-lifecycle";
import { parseQuestionText, summarize } from "@/domain/question-text";
import { RELEASE_LABELS, VISIBILITY_LABELS } from "@/features/exams/schemas";
import {
  closeExamNowAction,
  deleteExamAction,
  duplicateExamAction,
  openExamNowAction,
  publishExamAction,
  regenerateCodeAction,
  unpublishExamAction,
} from "@/features/exams/server/actions";
import { getExamDetail, listExamStudents } from "@/features/exams/server/queries";
import { formatDateTime } from "@/lib/datetime";
import { paths, ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";

export const metadata: Metadata = { title: "Examen" };

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-bold tracking-wide text-muted uppercase">{label}</dt>
      <dd className="text-[15px] font-semibold">{children}</dd>
    </div>
  );
}

export default async function ExamPage({ params }: { params: Promise<{ examId: string }> }) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { examId } = await params;
  if (!z.uuid().safeParse(examId).success) notFound();

  const exam = await getExamDetail(user, examId);
  const students = exam ? await listExamStudents(exam.id) : [];
  if (!exam) notFound();

  const phase = examPhase(exam, new Date());
  const editable = canEditContent(exam.attemptCount);
  const fields = { examId: exam.id };
  const qs = summarize(parseQuestionText(exam.sourceText ?? ""));
  const toPublish =
    phase === "BROUILLON"
      ? publishProblems(
          {
            title: exam.title,
            moduleId: exam.moduleId,
            groupCount: exam.groups.length + exam.candidates.length,
            opensAt: exam.opensAt,
            closesAt: exam.closesAt,
            questionCount: qs.questionCount,
            questionErrorCount: qs.errorCount,
            totalDurationSec: qs.totalDurationSec,
            timerMode: exam.timerMode,
            globalDurationSec: exam.globalDurationSec,
          },
          new Date(),
        )
      : [];

  return (
    <>
      <PageHeader
        icon={<FileText aria-hidden />}
        back={{ href: ROUTES.trainer.exams, label: "Examens" }}
        title={exam.title}
        description={[
          exam.moduleCode && `${exam.moduleCode} · ${exam.moduleName}`,
          user.role === "ADMIN" ? exam.authorName : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        actions={
          <>
            <ExamPhaseBadge phase={phase} />
            {exam.isPractice ? <Badge tone="info">Entraînement</Badge> : null}
            {phase !== "FERME" ? (
              <Link
                href={paths.editExam(exam.id)}
                className={buttonVariants({
                  variant: phase === "BROUILLON" && toPublish.length > 0 ? "mint" : "outline",
                })}
              >
                <Pencil aria-hidden />{" "}
                {phase === "BROUILLON" && toPublish.length > 0 ? "Compléter l'examen" : "Modifier"}
              </Link>
            ) : null}
            {phase === "BROUILLON" && toPublish.length === 0 ? (
              <InlineAction
                action={publishExamAction}
                fields={fields}
                variant="mint"
                confirmMessage="Publier l'examen ? Les étudiants des groupes choisis pourront entrer avec le code pendant la période d'ouverture."
                label={
                  <>
                    <Rocket aria-hidden /> Publier
                  </>
                }
              />
            ) : null}
          </>
        }
      />

      {toPublish.length > 0 ? (
        <div className="rounded-card border border-warning/30 bg-warning-bg px-5 py-4 text-sm">
          <p className="font-bold text-warning">
            Brouillon : {toPublish.length} point{toPublish.length > 1 ? "s" : ""} à compléter avant
            de publier
          </p>
          <ul className="mt-1 list-disc pl-5 text-ink-soft">
            {toPublish.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-6">
        {/* Code d'accès */}
        <Card className={phase === "BROUILLON" ? "opacity-70" : undefined}>
          <CardHeader>
            <CardTitle>Code d&apos;accès</CardTitle>
            <CardDescription>
              {phase === "BROUILLON"
                ? "Utilisable par les étudiants après la publication."
                : "À afficher en salle. Seuls les étudiants des groupes choisis peuvent entrer."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="font-mono text-5xl font-bold tracking-[0.25em] text-ink">
              {exam.accessCode ?? "——————"}
            </p>
            {exam.accessCode && phase !== "FERME" ? (
              <div className="flex flex-wrap gap-2">
                <CopyButton value={exam.accessCode} size="sm" variant="outline" />
                <InlineAction
                  action={regenerateCodeAction}
                  fields={fields}
                  size="sm"
                  variant="ghost"
                  label={
                    <>
                      <RefreshCw aria-hidden /> Nouveau code
                    </>
                  }
                  confirmMessage="Générer un nouveau code ? L'ancien ne fonctionnera plus."
                />
              </div>
            ) : null}
          </CardContent>
        </Card>

        {/* Informations */}
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4">
              <Info label="Ouverture">{formatDateTime(exam.opensAt)}</Info>
              <Info label="Fermeture">{formatDateTime(exam.closesAt)}</Info>
              <Info label="Questions">{exam.questionCount}</Info>
              <Info label={exam.timerMode === "GLOBAL" ? "Durée globale" : "Durée"}>
                {formatTotalDuration(exam.totalDurationSec)}
              </Info>
              <Info label="Points">{exam.totalPoints}</Info>
              <Info label="Tentatives">{exam.attemptCount}</Info>
              <Info label="Groupes">{exam.groups.map((g) => g.name).join(", ") || "—"}</Info>
              {exam.candidates.length > 0 ? (
                <Info label="Étudiants ajoutés">
                  <span title={exam.candidates.map((c) => c.fullName).join(", ")}>
                    {exam.candidates.length <= 3
                      ? exam.candidates.map((c) => c.fullName).join(", ")
                      : `${exam.candidates
                          .slice(0, 3)
                          .map((c) => c.fullName)
                          .join(", ")} +${exam.candidates.length - 3}`}
                  </span>
                </Info>
              ) : null}
              <Info label="Résultats">
                {VISIBILITY_LABELS[exam.resultVisibility].title},{" "}
                {RELEASE_LABELS[exam.resultReleaseMode].toLowerCase()}
              </Info>
            </dl>
          </CardContent>
        </Card>

        {/* Étudiants concernés */}
        <Card>
          <CardHeader>
            <CardTitle>
              Étudiants concernés{" "}
              <span className="text-base font-semibold text-muted">({students.length})</span>
            </CardTitle>
            <CardDescription>Membres des groupes choisis + étudiants ajoutés.</CardDescription>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="rounded-field bg-warning-bg px-3 py-2 text-sm font-semibold text-warning">
                Aucun étudiant : le groupe choisi est vide. Ajoutez des étudiants au groupe (page
                Groupes) ou individuellement dans l&apos;examen.
              </p>
            ) : (
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-primary">
                  Voir la liste
                </summary>
                <ul className="mt-3 flex max-h-72 flex-col gap-1 overflow-auto text-sm">
                  {students.map((s) => (
                    <li
                      key={s.id}
                      className="flex justify-between gap-3 border-b border-line-soft py-1.5"
                    >
                      <span className="font-semibold">{s.fullName}</span>
                      <span className="text-muted">{s.groups || "ajouté"}</span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-start gap-3">
            {phase === "PLANIFIE" ? (
              <InlineAction
                action={openExamNowAction}
                fields={fields}
                variant="mint"
                label={
                  <>
                    <DoorOpen aria-hidden /> Ouvrir maintenant
                  </>
                }
                confirmMessage="Ouvrir l'examen maintenant ? Les étudiants pourront commencer tout de suite."
              />
            ) : null}
            {phase === "OUVERT" || phase === "PLANIFIE" ? (
              <InlineAction
                action={closeExamNowAction}
                fields={fields}
                variant="danger"
                label={
                  <>
                    <DoorClosed aria-hidden /> Fermer maintenant
                  </>
                }
                confirmMessage="Fermer l'examen ? Plus personne ne pourra commencer."
              />
            ) : null}
            {(phase === "PLANIFIE" || phase === "OUVERT") && editable ? (
              <InlineAction
                action={unpublishExamAction}
                fields={fields}
                variant="ghost"
                label={
                  <>
                    <Undo2 aria-hidden /> Repasser en brouillon
                  </>
                }
              />
            ) : null}
            <InlineAction
              action={duplicateExamAction}
              fields={fields}
              variant="outline"
              label={
                <>
                  <Copy aria-hidden /> Dupliquer
                </>
              }
            />
            {exam.status !== "ARCHIVE" ? (
              <InlineAction
                action={deleteExamAction}
                fields={fields}
                variant="ghost"
                className="text-danger"
                label={
                  editable ? (
                    <>
                      <Trash2 aria-hidden /> Supprimer
                    </>
                  ) : (
                    <>
                      <Archive aria-hidden /> Archiver
                    </>
                  )
                }
                confirmMessage={
                  editable
                    ? `Supprimer définitivement « ${exam.title} » ?`
                    : `Archiver « ${exam.title} » ? ${exam.attemptCount} copie(s) : les résultats des stagiaires sont conservés et l'examen pourra être restauré.`
                }
              />
            ) : null}
            {phase !== "BROUILLON" ? (
              <div className="mt-2 flex flex-wrap gap-2 border-t border-line-soft pt-3">
                <Link
                  href={paths.examMonitor(exam.id)}
                  className={buttonVariants({ variant: "soft", size: "sm" })}
                >
                  <Radio aria-hidden /> Suivi en direct
                </Link>
                <Link
                  href={paths.examResults(exam.id)}
                  className={buttonVariants({ variant: "soft", size: "sm" })}
                >
                  <BarChart3 aria-hidden /> Résultats
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Questions */}
      <Card>
        <CardHeader>
          <CardTitle>Questions</CardTitle>
          <CardDescription className="flex items-center gap-2">
            <CalendarClock className="size-4" aria-hidden />
            Ordre de référence. Chaque étudiant reçoit un ordre mélangé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {exam.questions.length === 0 ? (
            <p className="text-sm text-muted">
              Aucune question enregistrée.{" "}
              {phase === "BROUILLON" ? (
                <Link href={paths.editExam(exam.id)} className="font-bold">
                  Ajouter des questions
                </Link>
              ) : null}
            </p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] gap-4">
              {exam.questions.map((q, i) => (
                <QuestionCard
                  key={q.id}
                  question={{
                    number: i + 1,
                    prompt: q.prompt,
                    code: q.code,
                    codeLanguage: q.codeLanguage,
                    options: q.options,
                    durationSec: q.durationSec,
                    points: q.points,
                    explanation: q.explanation,
                    algo: q.algo,
                    type: q.algo
                      ? q.algo.kind === "texte"
                        ? "REDACTION"
                        : "ALGORITHME"
                      : undefined,
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
