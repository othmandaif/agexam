import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { isMultipleAnswer } from "@/domain/attempt-rules";
import type { AttemptQuestionStatus, AttemptStatus } from "@/domain/enums";
import { examPhase } from "@/domain/exam-lifecycle";
import { revealLevel } from "@/domain/result-visibility";
import { isExactMatch } from "@/domain/scoring";
import {
  analyzeQuestion,
  histogram,
  summarizeScores,
  timeSpentSec,
  type QuestionResponse,
} from "@/domain/statistics";
import { getDb } from "@/server/db/client";
import { enrolledIdsSql } from "@/server/db/enrolment";
import {
  attemptQuestions,
  attempts,
  examGroups,
  examQuestions,
  exams,
  groupMembers,
  groups,
  profiles,
  questionVersions,
} from "@/server/db/schema";
import type { CopyQuestion, ExamResults, ResultStudent, StudentCopy } from "../types";

const FINISHED: AttemptStatus[] = ["SOUMISE", "SOUMISE_AUTO", "EXPIREE"];

interface StudentRow {
  profile_id: string;
  full_name: string;
  email: string;
  group_names: string | null;
  attempt_id: string | null;
  status: AttemptStatus | null;
  score_out_of_20: string | null;
  score_awarded: string | null;
  score_max: string | null;
  violation_count: number | null;
  flagged_for_review: boolean | null;
  started_at: string | null;
  submitted_at: string | null;
  receipt_code: string | null;
  correct: number | null;
  answered: number | null;
  total: number | null;
}

const iso = (v: string | Date | null) => (v ? new Date(v).toISOString() : null);
const num = (v: string | number | null) => (v === null ? null : Number(v));

/** Résultats complets d'un examen pour le formateur (droits vérifiés avant l'appel). */
export async function getExamResults(examId: string): Promise<ExamResults | null> {
  const db = getDb();
  const now = new Date();
  const [exam] = await db.select().from(exams).where(eq(exams.id, examId)).limit(1);
  if (!exam) return null;

  // Étudiants des groupes de l'examen + leur dernière tentative non annulée.
  const rows = (await db.execute(sql`
    select
      p.id as profile_id, p.full_name, p.email,
      coalesce(
        (select string_agg(distinct g.name, ', ' order by g.name)
           from ${groupMembers} gm2
           join ${examGroups} eg2 on eg2.group_id = gm2.group_id and eg2.exam_id = ${examId}
           join ${groups} g on g.id = gm2.group_id
          where gm2.profile_id = p.id),
        -- Étudiant ajouté individuellement (rattrapage) : ses propres groupes.
        (select string_agg(distinct g.name, ', ' order by g.name)
           from ${groupMembers} gm3 join ${groups} g on g.id = gm3.group_id
          where gm3.profile_id = p.id)
      ) as group_names,
      a.id as attempt_id, a.status, a.score_out_of_20, a.score_awarded, a.score_max,
      a.violation_count, a.flagged_for_review, a.started_at, a.submitted_at, a.receipt_code,
      (select count(*)::int from ${attemptQuestions} aq where aq.attempt_id = a.id and aq.is_correct) as correct,
      (select count(*)::int from ${attemptQuestions} aq
        where aq.attempt_id = a.id and jsonb_array_length(aq.selected_option_ids) > 0) as answered,
      (select count(*)::int from ${attemptQuestions} aq
         join ${examQuestions} eq on eq.id = aq.exam_question_id
        where aq.attempt_id = a.id and aq.status <> 'NEUTRALISEE' and eq.neutralized_at is null) as total
    from ${profiles} p
    join ${enrolledIdsSql(examId)} m on m.profile_id = p.id
    left join lateral (
      select * from ${attempts} x
      where x.exam_id = ${examId} and x.student_id = p.id and x.status <> 'ANNULEE'
      order by x.started_at desc
      limit 1
    ) a on true
    where p.role = 'ETUDIANT'
    order by p.full_name
  `)) as unknown as StudentRow[];

  const students: ResultStudent[] = rows.map((r) => {
    const startedAt = iso(r.started_at);
    const submittedAt = iso(r.submitted_at);
    return {
      profileId: r.profile_id,
      fullName: r.full_name,
      email: r.email,
      groups: r.group_names ?? "",
      attemptId: r.attempt_id,
      status: r.status ?? "ABSENT",
      scoreOutOf20: r.status && FINISHED.includes(r.status) ? num(r.score_out_of_20) : null,
      scoreAwarded: num(r.score_awarded),
      scoreMax: num(r.score_max),
      correct: r.correct ?? 0,
      answered: r.answered ?? 0,
      total: r.total ?? 0,
      violationCount: r.violation_count ?? 0,
      flagged: !!r.flagged_for_review,
      startedAt,
      submittedAt,
      durationSec:
        startedAt && submittedAt
          ? Math.round((Date.parse(submittedAt) - Date.parse(startedAt)) / 1000)
          : null,
      receiptCode: r.receipt_code,
      rank: null,
    };
  });

  // Rang (ex æquo : même rang).
  const graded = students
    .filter((s) => s.scoreOutOf20 !== null)
    .sort((a, b) => b.scoreOutOf20! - a.scoreOutOf20!);
  graded.forEach((s, i) => {
    const prev = graded[i - 1];
    s.rank = prev && prev.scoreOutOf20 === s.scoreOutOf20 ? prev.rank : i + 1;
  });
  const scoreByAttempt = new Map(graded.map((s) => [s.attemptId!, s.scoreOutOf20!]));

  // Questions de l'examen (ordre de référence) et réponses des copies notées.
  const questionRows = await db
    .select({
      id: examQuestions.id,
      position: examQuestions.position,
      points: examQuestions.points,
      durationSec: examQuestions.durationSec,
      neutralizedAt: examQuestions.neutralizedAt,
      prompt: questionVersions.prompt,
      code: questionVersions.code,
      codeLanguage: questionVersions.codeLanguage,
      options: questionVersions.options,
    })
    .from(examQuestions)
    .innerJoin(questionVersions, eq(questionVersions.id, examQuestions.questionVersionId))
    .where(eq(examQuestions.examId, examId))
    .orderBy(asc(examQuestions.position));

  const gradedIds = [...scoreByAttempt.keys()];
  const answerRows = gradedIds.length
    ? await db
        .select({
          attemptId: attemptQuestions.attemptId,
          examQuestionId: attemptQuestions.examQuestionId,
          status: attemptQuestions.status,
          selectedOptionIds: attemptQuestions.selectedOptionIds,
          shownAt: attemptQuestions.shownAt,
          answeredAt: attemptQuestions.answeredAt,
          expiresAt: attemptQuestions.expiresAt,
        })
        .from(attemptQuestions)
        .where(inArray(attemptQuestions.attemptId, gradedIds))
    : [];

  const byQuestion = new Map<string, typeof answerRows>();
  for (const a of answerRows) {
    const list = byQuestion.get(a.examQuestionId) ?? [];
    list.push(a);
    byQuestion.set(a.examQuestionId, list);
  }

  const questions = questionRows.map((q) => {
    const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
    const responses: QuestionResponse[] = (byQuestion.get(q.id) ?? [])
      // Question jamais affichée (copie soumise avant) : rien à analyser.
      .filter((a) => a.status !== "A_VENIR" && a.status !== "EN_COURS")
      .map((a) => ({
        studentScore: scoreByAttempt.get(a.attemptId) ?? 0,
        selectedOptionIds: a.selectedOptionIds,
        // Calculé avec la clé actuelle (à jour après une correction).
        isCorrect:
          a.status === "NEUTRALISEE" ? null : isExactMatch(a.selectedOptionIds, correctIds),
        invalidated: a.status === "INVALIDEE",
        timeSpentSec: timeSpentSec(a.shownAt, a.answeredAt ?? a.expiresAt, q.durationSec),
      }));
    return {
      examQuestionId: q.id,
      number: q.position + 1,
      prompt: q.prompt,
      code: q.code,
      codeLanguage: q.codeLanguage,
      options: q.options.map((o) => ({
        id: o.id,
        label: o.label,
        isCorrect: o.isCorrect,
        fixedPosition: o.fixedPosition,
      })),
      multiple: isMultipleAnswer(q.options),
      points: q.points,
      durationSec: q.durationSec,
      neutralized: q.neutralizedAt !== null,
      analysis: analyzeQuestion(
        responses,
        correctIds,
        q.options.map((o) => o.id),
      ),
    };
  });

  const scores = graded.map((s) => s.scoreOutOf20!);
  return {
    exam: {
      id: exam.id,
      title: exam.title,
      status: exam.status,
      phase: examPhase(exam, now),
      opensAt: iso(exam.opensAt),
      closesAt: iso(exam.closesAt),
      resultVisibility: exam.resultVisibility,
      resultReleaseMode: exam.resultReleaseMode,
      resultsPublishedAt: iso(exam.resultsPublishedAt),
      bonusPoints: Number(exam.bonusPoints ?? 0),
      studentSees: revealLevel(
        {
          visibility: exam.resultVisibility,
          releaseMode: exam.resultReleaseMode,
          examStatus: exam.status,
          examClosesAt: exam.closesAt ?? now,
          resultsPublishedAt: exam.resultsPublishedAt,
          attemptSubmitted: true,
        },
        now,
      ),
    },
    summary: {
      ...summarizeScores(scores),
      enrolled: students.length,
      submitted: graded.length,
      inProgress: students.filter((s) => s.status === "EN_COURS").length,
      absent: students.filter((s) => s.status === "ABSENT").length,
      flagged: students.filter((s) => s.flagged).length,
      avgDurationSec: (() => {
        const d = students.map((s) => s.durationSec).filter((x): x is number => x !== null);
        return d.length ? Math.round(d.reduce((a, b) => a + b, 0) / d.length) : null;
      })(),
    },
    histogram: histogram(scores),
    students,
    questions,
  };
}

/** Copie détaillée d'un étudiant, vue formateur : bonnes réponses comprises. */
export async function getStudentCopy(
  examId: string,
  attemptId: string,
): Promise<StudentCopy | null> {
  const db = getDb();
  const [row] = await db
    .select({ attempt: attempts, examTitle: exams.title, student: profiles })
    .from(attempts)
    .innerJoin(exams, eq(exams.id, attempts.examId))
    .innerJoin(profiles, eq(profiles.id, attempts.studentId))
    .where(and(eq(attempts.id, attemptId), eq(attempts.examId, examId)))
    .limit(1);
  if (!row) return null;

  const rows = await db
    .select({
      id: attemptQuestions.id,
      position: attemptQuestions.position,
      optionOrder: attemptQuestions.optionOrder,
      status: attemptQuestions.status,
      selectedOptionIds: attemptQuestions.selectedOptionIds,
      isCorrect: attemptQuestions.isCorrect,
      pointsAwarded: attemptQuestions.pointsAwarded,
      shownAt: attemptQuestions.shownAt,
      answeredAt: attemptQuestions.answeredAt,
      expiresAt: attemptQuestions.expiresAt,
      referencePosition: examQuestions.position,
      points: examQuestions.points,
      durationSec: examQuestions.durationSec,
      neutralizedAt: examQuestions.neutralizedAt,
      prompt: questionVersions.prompt,
      code: questionVersions.code,
      codeLanguage: questionVersions.codeLanguage,
      options: questionVersions.options,
      explanation: questionVersions.explanation,
    })
    .from(attemptQuestions)
    .innerJoin(examQuestions, eq(examQuestions.id, attemptQuestions.examQuestionId))
    .innerJoin(questionVersions, eq(questionVersions.id, examQuestions.questionVersionId))
    .where(eq(attemptQuestions.attemptId, attemptId))
    .orderBy(asc(attemptQuestions.position));

  const questions: CopyQuestion[] = rows.map((q) => {
    const byId = new Map(q.options.map((o) => [o.id, o]));
    const ordered = q.optionOrder.map((id) => byId.get(id)).filter((o) => o !== undefined);
    const seen = q.status !== "A_VENIR";
    return {
      attemptQuestionId: q.id,
      number: q.position + 1,
      referenceNumber: q.referencePosition + 1,
      prompt: q.prompt,
      code: q.code,
      codeLanguage: q.codeLanguage,
      options: ordered.map((o) => ({
        id: o.id,
        label: o.label,
        isCorrect: o.isCorrect,
        fixedPosition: o.fixedPosition,
      })),
      multiple: isMultipleAnswer(q.options),
      status: q.status as AttemptQuestionStatus,
      examNeutralized: q.neutralizedAt !== null,
      selectedOptionIds: q.selectedOptionIds,
      isCorrect: q.isCorrect,
      pointsAwarded: q.pointsAwarded,
      points: q.points,
      durationSec: q.durationSec,
      timeSpentSec: seen
        ? timeSpentSec(q.shownAt, q.answeredAt ?? q.expiresAt, q.durationSec)
        : null,
      explanation: q.explanation,
    };
  });

  const a = row.attempt;
  return {
    examId,
    examTitle: row.examTitle,
    attemptId: a.id,
    student: { id: row.student.id, fullName: row.student.fullName, email: row.student.email },
    status: a.status,
    attemptNumber: a.attemptNumber,
    startedAt: a.startedAt.toISOString(),
    submittedAt: iso(a.submittedAt),
    receiptCode: a.receiptCode,
    scoreOutOf20: a.scoreOutOf20,
    scoreAwarded: a.scoreAwarded,
    scoreMax: a.scoreMax,
    violationCount: a.violationCount,
    neutralizations: a.networkNeutralizations,
    flagged: a.flaggedForReview,
    questions,
  };
}
