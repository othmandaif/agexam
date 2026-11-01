import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { ResultVisibility } from "@/domain/enums";
import { examPhase } from "@/domain/exam-lifecycle";
import type { QuestionOption } from "@/domain/exam-settings";
import { revealLevel } from "@/domain/result-visibility";
import type { TenantUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { isEnrolledSql } from "@/server/db/enrolment";
import {
  attemptQuestions,
  attempts,
  examQuestions,
  exams,
  modules,
  questionVersions,
} from "@/server/db/schema";

// Sous-requêtes corrélées : colonne qualifiée explicitement.
const examIdRef = sql`${sql.identifier("exams")}.${sql.identifier("id")}`;

/** Examen tel que vu par un étudiant avant de commencer (s'il fait partie d'un groupe concerné). */
export async function getExamForStudent(student: TenantUser, examId: string) {
  const db = getDb();
  const [exam] = await db
    .select({
      id: exams.id,
      title: exams.title,
      description: exams.description,
      status: exams.status,
      opensAt: exams.opensAt,
      closesAt: exams.closesAt,
      maxAttempts: exams.maxAttempts,
      isPractice: exams.isPractice,
      violationPolicy: exams.violationPolicy,
      timerMode: exams.timerMode,
      globalDurationSec: exams.globalDurationSec,
      moduleCode: modules.code,
      moduleName: modules.name,
    })
    .from(exams)
    .leftJoin(modules, eq(modules.id, exams.moduleId))
    .where(
      and(
        eq(exams.id, examId),
        eq(exams.establishmentId, student.establishmentId),
        isEnrolledSql(examIdRef, student.id),
      ),
    )
    .limit(1);
  if (!exam || exam.status === "BROUILLON") return null;

  const [stats] = await db
    .select({
      questionCount: sql<number>`count(*)::int`,
      totalDurationSec: sql<number>`coalesce(sum(${examQuestions.durationSec}), 0)::int`,
      minDurationSec: sql<number>`coalesce(min(${examQuestions.durationSec}), 0)::int`,
      maxDurationSec: sql<number>`coalesce(max(${examQuestions.durationSec}), 0)::int`,
    })
    .from(examQuestions)
    .where(eq(examQuestions.examId, examId));

  const mine = await db
    .select({
      id: attempts.id,
      status: attempts.status,
      submittedAt: attempts.submittedAt,
      scoreOutOf20: attempts.scoreOutOf20,
      freePending: freePendingSql,
    })
    .from(attempts)
    .where(and(eq(attempts.examId, examId), eq(attempts.studentId, student.id)))
    .orderBy(desc(attempts.startedAt));

  return {
    ...exam,
    ...stats!,
    // Durée effective affichée à l'étudiant.
    totalDurationSec:
      exam.timerMode === "GLOBAL" ? (exam.globalDurationSec ?? 0) : stats!.totalDurationSec,
    phase: examPhase(exam, new Date()),
    activeAttemptId: mine.find((a) => a.status === "EN_COURS")?.id ?? null,
    lastFinishedAttemptId:
      mine.find((a) => a.status !== "EN_COURS" && a.status !== "ANNULEE")?.id ?? null,
    attemptsUsed: mine.filter((a) => a.status !== "ANNULEE").length,
    /** Entraînement : essais terminés (le plus récent d'abord), avec la note. */
    practiceHistory: exam.isPractice
      ? mine
          .filter((a) => a.status !== "EN_COURS" && a.status !== "ANNULEE")
          .slice(0, 10)
          .map((a) => ({
            id: a.id,
            submittedAt: a.submittedAt,
            scoreOutOf20: a.freePending ? null : a.scoreOutOf20,
          }))
      : [],
  };
}

/** Examen ouvert correspondant à un code, pour un étudiant d'un groupe concerné. */
export async function findExamByCode(student: TenantUser, code: string) {
  const [exam] = await getDb()
    .select({ id: exams.id })
    .from(exams)
    .where(
      and(
        eq(exams.establishmentId, student.establishmentId),
        eq(exams.accessCode, code),
        sql`${exams.status} not in ('BROUILLON', 'ARCHIVE')`,
        isEnrolledSql(examIdRef, student.id),
      ),
    )
    .limit(1);
  return exam ?? null;
}

/**
 * Réponse libre (algorithme / rédaction) rendue dont la note n'est pas encore
 * définitive : la note de la copie n'est pas montrée à l'étudiant.
 */
const freePendingSql = sql<boolean>`exists (
  select 1 from ${attemptQuestions} fq
  where fq.attempt_id = ${attempts.id}
    and coalesce(btrim(fq.code_answer), '') <> ''
    and fq.status <> 'INVALIDEE'
    and coalesce(fq.grading->>'status', '') <> 'done'
)`;

const releaseFields = {
  isPractice: exams.isPractice,
  resultVisibility: exams.resultVisibility,
  resultReleaseMode: exams.resultReleaseMode,
  resultsPublishedAt: exams.resultsPublishedAt,
  examStatus: exams.status,
  opensAt: exams.opensAt,
  closesAt: exams.closesAt,
  attemptReleasedAt: attempts.releasedAt,
  validateAlgo: sql<boolean>`coalesce((${exams.securitySettings}->>'validateAlgoGrades')::boolean, true)`,
  freePending: freePendingSql,
};

/** Tentatives de l'étudiant : en cours (à reprendre) et terminées, avec ce qui est publiable. */
export async function listStudentAttempts(student: TenantUser) {
  const rows = await getDb()
    .select({
      id: attempts.id,
      examId: attempts.examId,
      examTitle: exams.title,
      status: attempts.status,
      submittedAt: attempts.submittedAt,
      scoreOutOf20: attempts.scoreOutOf20,
      ...releaseFields,
    })
    .from(attempts)
    .innerJoin(exams, eq(exams.id, attempts.examId))
    .where(and(eq(attempts.studentId, student.id), sql`${attempts.status} <> 'ANNULEE'`))
    .orderBy(desc(attempts.startedAt))
    .limit(30);

  const now = new Date();
  return rows.map((r) => {
    const level =
      r.status === "EN_COURS"
        ? "AUCUNE"
        : r.isPractice
          ? "CORRECTION"
          : revealLevel(
              {
                visibility: r.resultVisibility,
                releaseMode: r.resultReleaseMode,
                examStatus: r.examStatus,
                examClosesAt: r.closesAt ?? now,
                resultsPublishedAt: r.resultsPublishedAt,
                attemptSubmitted: true,
                attemptReleasedAt: r.attemptReleasedAt,
              },
              now,
            );
    return {
      id: r.id,
      examTitle: r.examTitle,
      status: r.status,
      submittedAt: r.submittedAt,
      // La note n'est envoyée que si elle est publiée et définitive.
      scoreOutOf20: level === "AUCUNE" || r.freePending ? null : r.scoreOutOf20,
      /** Résultat en attente de la validation / correction d'une réponse libre. */
      awaiting: level !== "AUCUNE" && r.freePending,
    };
  });
}

/** Reçu + résultat d'une tentative terminée, filtré selon ce que le formateur a publié. */
export async function getStudentResult(student: TenantUser, attemptId: string) {
  const db = getDb();
  const [row] = await db
    .select({
      id: attempts.id,
      status: attempts.status,
      submittedAt: attempts.submittedAt,
      receiptCode: attempts.receiptCode,
      scoreAwarded: attempts.scoreAwarded,
      scoreMax: attempts.scoreMax,
      scoreOutOf20: attempts.scoreOutOf20,
      examTitle: exams.title,
      ...releaseFields,
    })
    .from(attempts)
    .innerJoin(exams, eq(exams.id, attempts.examId))
    .where(and(eq(attempts.id, attemptId), eq(attempts.studentId, student.id)))
    .limit(1);
  if (!row) return null;

  const now = new Date();
  // Entraînement : correction complète dès la fin de l'essai.
  let level: ResultVisibility =
    row.status === "EN_COURS"
      ? "AUCUNE"
      : row.isPractice
        ? "CORRECTION"
        : revealLevel(
            {
              visibility: row.resultVisibility,
              releaseMode: row.resultReleaseMode,
              examStatus: row.examStatus,
              examClosesAt: row.closesAt ?? now,
              resultsPublishedAt: row.resultsPublishedAt,
              attemptSubmitted: true,
              attemptReleasedAt: row.attemptReleasedAt,
            },
            now,
          );

  const rows = await db
    .select({
      position: attemptQuestions.position,
      status: attemptQuestions.status,
      examNeutralizedAt: examQuestions.neutralizedAt,
      selectedOptionIds: attemptQuestions.selectedOptionIds,
      optionOrder: attemptQuestions.optionOrder,
      isCorrect: attemptQuestions.isCorrect,
      pointsAwarded: attemptQuestions.pointsAwarded,
      points: examQuestions.points,
      prompt: questionVersions.prompt,
      code: questionVersions.code,
      codeLanguage: questionVersions.codeLanguage,
      options: questionVersions.options,
      explanation: questionVersions.explanation,
      isAlgo: sql<boolean>`${questionVersions.algo} is not null`,
      isText: sql<boolean>`coalesce(${questionVersions.algo}->>'kind', '') = 'texte'`,
      codeAnswer: attemptQuestions.codeAnswer,
      grading: attemptQuestions.grading,
    })
    .from(attemptQuestions)
    .innerJoin(examQuestions, eq(examQuestions.id, attemptQuestions.examQuestionId))
    .innerJoin(questionVersions, eq(questionVersions.id, examQuestions.questionVersionId))
    .where(eq(attemptQuestions.attemptId, attemptId))
    .orderBy(asc(attemptQuestions.position));
  // Question neutralisée par le formateur pour tout l'examen : affichée comme neutralisée.
  const questions = rows.map(({ examNeutralizedAt, ...q }) =>
    examNeutralizedAt ? { ...q, status: "NEUTRALISEE" as const } : q,
  );

  const answered = (q: (typeof questions)[number]) =>
    q.isAlgo ? !!q.codeAnswer?.trim() : q.selectedOptionIds.length > 0;
  const gradingPending = questions.some(
    (q) => q.isAlgo && ["pending", "running", "proposed"].includes(q.grading?.status ?? ""),
  );
  // Réponse libre rendue sans note définitive : aucune note partielle n'est montrée.
  const freeNotFinal = questions.filter(
    (q) =>
      q.isAlgo &&
      answered(q) &&
      q.status !== "INVALIDEE" &&
      q.status !== "NEUTRALISEE" &&
      q.grading?.status !== "done",
  );
  const awaiting: "validation" | "correction" | null =
    level === "AUCUNE" || freeNotFinal.length === 0
      ? null
      : row.validateAlgo ||
          freeNotFinal.some(
            (q) => q.grading?.status === "proposed" || q.grading?.status === "failed",
          )
        ? "validation"
        : "correction";
  if (awaiting) level = "AUCUNE";
  const counts = {
    total: questions.length,
    answered: questions.filter(answered).length,
    correct: questions.filter((q) => q.isCorrect === true).length,
    wrong: questions.filter((q) => q.isCorrect === false && answered(q) && q.status !== "INVALIDEE")
      .length,
    unanswered: questions.filter(
      (q) => !answered(q) && q.status !== "NEUTRALISEE" && q.status !== "INVALIDEE",
    ).length,
    invalidated: questions.filter((q) => q.status === "INVALIDEE").length,
    neutralized: questions.filter((q) => q.status === "NEUTRALISEE").length,
  };

  return {
    receipt: {
      examTitle: row.examTitle,
      status: row.status,
      submittedAt: row.submittedAt,
      receiptCode: row.receiptCode,
      answered: counts.answered,
      total: counts.total,
    },
    level,
    gradingPending,
    awaiting,
    // Rien n'est envoyé au-delà du niveau publié.
    score:
      level === "AUCUNE"
        ? null
        : {
            outOf20: row.scoreOutOf20,
            awarded: row.scoreAwarded,
            max: row.scoreMax,
            pending: false,
          },
    counts: level === "NOTE_DETAIL" || level === "CORRECTION" ? counts : null,
    correction:
      level === "CORRECTION"
        ? questions.map((q) => {
            const byId = new Map((q.options as QuestionOption[]).map((o) => [o.id, o]));
            return {
              number: q.position + 1,
              status: q.status,
              prompt: q.prompt,
              code: q.code,
              codeLanguage: q.codeLanguage,
              explanation: q.explanation,
              points: q.points,
              pointsAwarded: q.pointsAwarded,
              // Algorithme : code rendu et correction automatique (ni corrigé ni détail interne).
              algo: q.isAlgo
                ? {
                    kind: q.isText ? ("texte" as const) : ("algo" as const),
                    code: q.codeAnswer,
                    pending: ["pending", "running", "proposed"].includes(q.grading?.status ?? ""),
                    testsPassed: q.grading?.testsPassed ?? null,
                    testsTotal: q.grading?.testsTotal ?? null,
                    comment: q.grading?.status === "done" ? (q.grading.comment ?? null) : null,
                  }
                : null,
              options: q.optionOrder
                .map((id) => byId.get(id))
                .filter((o): o is QuestionOption => !!o)
                .map((o) => ({
                  label: o.label,
                  isCorrect: o.isCorrect,
                  selected: q.selectedOptionIds.includes(o.id),
                })),
            };
          })
        : null,
  };
}

export type StudentResult = NonNullable<Awaited<ReturnType<typeof getStudentResult>>>;
