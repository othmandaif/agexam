import "server-only";
import { and, eq, isNull, max, ne, sql } from "drizzle-orm";
import type { AlgoGrading } from "@/domain/algo-grading";
import { isMultipleAnswer } from "@/domain/attempt-rules";
import type { ResultReleaseMode, ResultVisibility } from "@/domain/enums";
import { parseQuestionText, setCorrectAnswers } from "@/domain/question-text";
import { gradeAttemptAlgos } from "@/features/attempts/server/algo-grader";
import { rescoreAttempt, rescoreExam } from "@/features/attempts/server/engine";
import { getEditableExam } from "@/features/exams/server/service";
import { audit } from "@/server/audit";
import type { TenantUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import {
  attemptQuestions,
  attempts,
  examQuestions,
  exams,
  questions,
  questionVersions,
} from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import { questionFingerprint } from "@/server/questions/fingerprint";

async function examQuestionOf(examId: string, examQuestionId: string) {
  const [row] = await getDb()
    .select({
      id: examQuestions.id,
      position: examQuestions.position,
      neutralizedAt: examQuestions.neutralizedAt,
      version: questionVersions,
    })
    .from(examQuestions)
    .innerJoin(questionVersions, eq(questionVersions.id, examQuestions.questionVersionId))
    .where(and(eq(examQuestions.id, examQuestionId), eq(examQuestions.examId, examId)))
    .limit(1);
  if (!row) throw errors.notFound("Question introuvable dans cet examen.");
  return row;
}

/**
 * Neutralise (ou rétablit) une question pour toutes les copies : elle sort du barème
 * et toutes les notes sont recalculées. Pour une question à l'énoncé erroné.
 */
export async function setQuestionNeutralized(
  staff: TenantUser,
  examId: string,
  examQuestionId: string,
  neutralized: boolean,
) {
  const exam = await getEditableExam(staff, examId);
  const question = await examQuestionOf(exam.id, examQuestionId);
  if (neutralized === (question.neutralizedAt !== null)) {
    throw errors.conflict(neutralized ? "Question déjà neutralisée." : "Question déjà comptée.");
  }

  return getDb().transaction(async (tx) => {
    if (neutralized) {
      const remaining = await tx.$count(
        examQuestions,
        and(
          eq(examQuestions.examId, exam.id),
          isNull(examQuestions.neutralizedAt),
          ne(examQuestions.id, question.id),
        ),
      );
      if (remaining === 0) {
        throw errors.conflict("Impossible : au moins une question doit rester comptée.");
      }
    }
    await tx
      .update(examQuestions)
      .set({ neutralizedAt: neutralized ? new Date() : null })
      .where(eq(examQuestions.id, question.id));
    const rescored = await rescoreExam(tx, exam.id);
    await audit(tx, {
      actorId: staff.id,
      action: neutralized ? "exam_question.neutralize" : "exam_question.restore",
      entityType: "exam_question",
      entityId: question.id,
      payload: { examId: exam.id, number: question.position + 1, rescored },
    });
    return { rescored };
  });
}

/**
 * Corrige la clé d'une question (bonne réponse mal saisie). Crée une nouvelle version
 * de la question (l'ancienne reste dans l'historique), met à jour le texte source de
 * l'examen et recalcule toutes les notes.
 * Une question à réponse unique garde une seule bonne réponse, une question à cases
 * à cocher en garde au moins deux : l'étudiant a répondu avec cette consigne.
 */
export async function correctAnswerKey(
  staff: TenantUser,
  examId: string,
  examQuestionId: string,
  correctOptionIds: string[],
) {
  const exam = await getEditableExam(staff, examId);
  const question = await examQuestionOf(exam.id, examQuestionId);
  const current = question.version;
  const ids = new Set(correctOptionIds);
  if (ids.size === 0) throw errors.badRequest("Choisissez au moins une bonne réponse.");
  if ([...ids].some((id) => !current.options.some((o) => o.id === id))) {
    throw errors.badRequest("Réponse inconnue pour cette question.");
  }
  const wasMultiple = isMultipleAnswer(current.options);
  if (!wasMultiple && ids.size !== 1) {
    throw errors.badRequest(
      "Question à réponse unique : choisissez une seule bonne réponse (ou neutralisez-la).",
    );
  }
  if (wasMultiple && ids.size < 2) {
    throw errors.badRequest(
      "Question à plusieurs réponses : gardez au moins deux bonnes réponses (ou neutralisez-la).",
    );
  }
  const options = current.options.map((o) => ({ ...o, isCorrect: ids.has(o.id) }));
  if (options.every((o, i) => o.isCorrect === current.options[i]!.isCorrect)) {
    throw errors.conflict("Ce sont déjà les bonnes réponses.");
  }

  return getDb().transaction(async (tx) => {
    const [{ last } = { last: current.version }] = await tx
      .select({ last: max(questionVersions.version) })
      .from(questionVersions)
      .where(eq(questionVersions.questionId, current.questionId));
    const version = (last ?? current.version) + 1;
    const [created] = await tx
      .insert(questionVersions)
      .values({
        questionId: current.questionId,
        version,
        prompt: current.prompt,
        code: current.code,
        codeLanguage: current.codeLanguage,
        options,
        explanation: current.explanation,
        defaultPoints: current.defaultPoints,
        fingerprint: questionFingerprint({ ...current, options }),
      })
      .returning({ id: questionVersions.id });
    await tx
      .update(questions)
      .set({ currentVersion: version })
      .where(eq(questions.id, current.questionId));
    await tx
      .update(examQuestions)
      .set({ questionVersionId: created!.id })
      .where(eq(examQuestions.id, question.id));

    // Texte source : on réécrit seulement les « * » de cette question.
    if (exam.sourceText) {
      const parsed = parseQuestionText(exam.sourceText).questions[question.position];
      if (parsed && parsed.options.length === options.length) {
        const letters = parsed.options.filter((_, i) => options[i]!.isCorrect).map((o) => o.letter);
        await tx
          .update(exams)
          .set({ sourceText: setCorrectAnswers(exam.sourceText, parsed, letters) })
          .where(eq(exams.id, exam.id));
      }
    }

    const rescored = await rescoreExam(tx, exam.id);
    await audit(tx, {
      actorId: staff.id,
      action: "exam_question.correct_key",
      entityType: "exam_question",
      entityId: question.id,
      payload: {
        examId: exam.id,
        number: question.position + 1,
        before: current.options.filter((o) => o.isCorrect).map((o) => o.id),
        after: [...ids],
        version,
        rescored,
      },
    });
    return { rescored };
  });
}

/**
 * Bonus pour toute la classe (ex. +2 sur 20), note plafonnée à 20.
 * Toutes les copies terminées sont recalculées ; les copies en cours le
 * recevront à la soumission.
 */
export async function setClassBonus(staff: TenantUser, examId: string, bonusPoints: number) {
  const exam = await getEditableExam(staff, examId);
  return getDb().transaction(async (tx) => {
    await tx.update(exams).set({ bonusPoints }).where(eq(exams.id, exam.id));
    const rescored = await rescoreExam(tx, exam.id);
    await audit(tx, {
      actorId: staff.id,
      action: "exam.class_bonus",
      entityType: "exam",
      entityId: exam.id,
      payload: { from: exam.bonusPoints, to: bonusPoints, rescored },
    });
    return { rescored };
  });
}

/** Publie (ou retire) les résultats en mode « publication manuelle ». */
export async function setResultsPublished(staff: TenantUser, examId: string, published: boolean) {
  const exam = await getEditableExam(staff, examId);
  if (exam.status === "BROUILLON") throw errors.conflict("L'examen n'est pas publié.");
  await getDb().transaction(async (tx) => {
    await tx
      .update(exams)
      .set({
        resultReleaseMode: "MANUEL",
        resultsPublishedAt: published ? new Date() : null,
      })
      .where(eq(exams.id, exam.id));
    await audit(tx, {
      actorId: staff.id,
      action: published ? "exam.results_publish" : "exam.results_unpublish",
      entityType: "exam",
      entityId: exam.id,
    });
  });
}

/** Ce que voient les étudiants, et quand. Modifiable à tout moment. */
export async function updateResultSettings(
  staff: TenantUser,
  examId: string,
  input: { visibility: ResultVisibility; releaseMode: ResultReleaseMode },
) {
  const exam = await getEditableExam(staff, examId);
  await getDb().transaction(async (tx) => {
    await tx
      .update(exams)
      .set({ resultVisibility: input.visibility, resultReleaseMode: input.releaseMode })
      .where(eq(exams.id, exam.id));
    await audit(tx, {
      actorId: staff.id,
      action: "exam.result_settings",
      entityType: "exam",
      entityId: exam.id,
      payload: input,
    });
  });
}

async function manageableAttempt(staff: TenantUser, attemptId: string) {
  const [row] = await getDb()
    .select({ id: attempts.id, examId: attempts.examId, status: attempts.status })
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);
  if (!row) throw errors.notFound("Copie introuvable.");
  await getEditableExam(staff, row.examId);
  return row;
}

/** Rend la copie à l'étudiant (note visible selon le niveau de détail choisi), ou la reprend. */
export async function setAttemptReleased(staff: TenantUser, attemptId: string, released: boolean) {
  const attempt = await manageableAttempt(staff, attemptId);
  await getDb().transaction(async (tx) => {
    await tx
      .update(attempts)
      .set({ releasedAt: released ? new Date() : null })
      .where(eq(attempts.id, attempt.id));
    await audit(tx, {
      actorId: staff.id,
      action: released ? "attempt.released" : "attempt.unreleased",
      entityType: "attempt",
      entityId: attempt.id,
    });
  });
  return attempt;
}

/** Marque une copie « à revoir » comme vérifiée (ou la signale de nouveau). */
export async function setAttemptReviewed(staff: TenantUser, attemptId: string, reviewed: boolean) {
  const attempt = await manageableAttempt(staff, attemptId);
  await getDb().transaction(async (tx) => {
    await tx
      .update(attempts)
      .set({ flaggedForReview: !reviewed })
      .where(eq(attempts.id, attempt.id));
    await audit(tx, {
      actorId: staff.id,
      action: reviewed ? "attempt.reviewed" : "attempt.flag",
      entityType: "attempt",
      entityId: attempt.id,
    });
  });
  return attempt;
}

/**
 * Annule une copie terminée pour que l'étudiant puisse repasser l'examen (problème
 * technique, absence justifiée…). La copie reste en base, hors des résultats.
 */
export async function allowRetake(staff: TenantUser, attemptId: string) {
  const attempt = await manageableAttempt(staff, attemptId);
  if (attempt.status === "EN_COURS") {
    throw errors.conflict("L'étudiant est en train de composer : attendez la fin de sa copie.");
  }
  if (attempt.status === "ANNULEE") throw errors.conflict("Cette copie est déjà annulée.");
  await getDb().transaction(async (tx) => {
    await tx
      .update(attempts)
      .set({ status: "ANNULEE", flaggedForReview: false })
      .where(eq(attempts.id, attempt.id));
    await audit(tx, {
      actorId: staff.id,
      action: "attempt.allow_retake",
      entityType: "attempt",
      entityId: attempt.id,
      payload: { previousStatus: attempt.status },
    });
  });
  return attempt;
}

// ── Questions d'algorithme ──────────────────────────────────────────────

async function algoAnswerOf(staff: TenantUser, attemptQuestionId: string) {
  const [row] = await getDb()
    .select({
      id: attemptQuestions.id,
      attemptId: attemptQuestions.attemptId,
      grading: attemptQuestions.grading,
      points: examQuestions.points,
      isAlgo: sql<boolean>`${questionVersions.algo} is not null`,
    })
    .from(attemptQuestions)
    .innerJoin(examQuestions, eq(examQuestions.id, attemptQuestions.examQuestionId))
    .innerJoin(questionVersions, eq(questionVersions.id, examQuestions.questionVersionId))
    .where(eq(attemptQuestions.id, attemptQuestionId))
    .limit(1);
  if (!row || !row.isAlgo) throw errors.notFound("Question d'algorithme introuvable.");
  const attempt = await manageableAttempt(staff, row.attemptId);
  if (attempt.status === "EN_COURS" || attempt.status === "ANNULEE") {
    throw errors.conflict("La copie n'est pas terminée.");
  }
  return { ...row, attempt };
}

/** Relance la correction automatique d'un algorithme (attendue ici, quelques secondes). */
export async function regradeAlgo(staff: TenantUser, attemptQuestionId: string) {
  const row = await algoAnswerOf(staff, attemptQuestionId);
  await getDb()
    .update(attemptQuestions)
    .set({ grading: { status: "pending", tries: 0 } })
    .where(eq(attemptQuestions.id, row.id));
  await gradeAttemptAlgos(row.attemptId);
  return row.attempt;
}

/** Note fixée par le formateur (remplace la correction automatique). */
export async function setAlgoManualGrade(
  staff: TenantUser,
  attemptQuestionId: string,
  points: number,
  comment: string | null,
) {
  const row = await algoAnswerOf(staff, attemptQuestionId);
  if (points < 0 || points > row.points) {
    throw errors.badRequest(`Note entre 0 et ${row.points} point(s).`);
  }
  const grading: AlgoGrading = {
    ...row.grading,
    status: "done",
    source: "manual",
    ratio: row.points > 0 ? points / row.points : 0,
    comment: comment ?? row.grading?.comment,
    gradedAt: new Date().toISOString(),
  };
  await getDb().transaction(async (tx) => {
    await tx.update(attemptQuestions).set({ grading }).where(eq(attemptQuestions.id, row.id));
    await rescoreAttempt(tx, row.attemptId);
    await audit(tx, {
      actorId: staff.id,
      action: "attempt_question.manual_grade",
      entityType: "attempt_question",
      entityId: row.id,
      payload: { points, previous: row.grading?.ratio ?? null },
    });
  });
  return row.attempt;
}

/** Valide la note proposée par la correction automatique (option de l'examen). */
export async function acceptAlgoGrade(staff: TenantUser, attemptQuestionId: string) {
  const row = await algoAnswerOf(staff, attemptQuestionId);
  if (row.grading?.status !== "proposed") throw errors.conflict("Aucune note proposée à valider.");
  await getDb().transaction(async (tx) => {
    await tx
      .update(attemptQuestions)
      .set({ grading: { ...row.grading!, status: "done", gradedAt: new Date().toISOString() } })
      .where(eq(attemptQuestions.id, row.id));
    await rescoreAttempt(tx, row.attemptId);
    await audit(tx, {
      actorId: staff.id,
      action: "attempt_question.accept_grade",
      entityType: "attempt_question",
      entityId: row.id,
      payload: { ratio: row.grading!.ratio ?? 0 },
    });
  });
  return row.attempt;
}

/** Valide d'un coup toutes les notes proposées d'un examen (copies terminées). */
export async function acceptAllProposedGrades(staff: TenantUser, examId: string) {
  await getEditableExam(staff, examId);
  return getDb().transaction(async (tx) => {
    const rows = await tx
      .select({
        id: attemptQuestions.id,
        attemptId: attemptQuestions.attemptId,
        grading: attemptQuestions.grading,
      })
      .from(attemptQuestions)
      .innerJoin(attempts, eq(attempts.id, attemptQuestions.attemptId))
      .where(
        and(
          eq(attempts.examId, examId),
          sql`${attempts.status} not in ('EN_COURS', 'ANNULEE')`,
          sql`${attemptQuestions.grading}->>'status' = 'proposed'`,
        ),
      );
    const now = new Date().toISOString();
    for (const r of rows) {
      await tx
        .update(attemptQuestions)
        .set({ grading: { ...r.grading!, status: "done", gradedAt: now } })
        .where(eq(attemptQuestions.id, r.id));
    }
    for (const attemptId of new Set(rows.map((r) => r.attemptId))) {
      await rescoreAttempt(tx, attemptId);
    }
    await audit(tx, {
      actorId: staff.id,
      action: "exam.accept_all_grades",
      entityType: "exam",
      entityId: examId,
      payload: { count: rows.length },
    });
    return rows.length;
  });
}
