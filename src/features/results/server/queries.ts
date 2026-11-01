import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import type { AlgoGrading } from "@/domain/algo-grading";
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
  algo_to_review: number | null;
  released_at: string | null;
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
      a.violation_count, a.flagged_for_review, a.released_at, a.started_at, a.submitted_at, a.receipt_code,
      (select count(*)::int from ${attemptQuestions} aq where aq.attempt_id = a.id and aq.is_correct) as correct,
      (select count(*)::int from ${attemptQuestions} aq
        where aq.attempt_id = a.id
          and (jsonb_array_length(aq.selected_option_ids) > 0
               or coalesce(btrim(aq.code_answer), '') <> '')) as answered,
      (select count(*)::int from ${attemptQuestions} aq
        where aq.attempt_id = a.id and aq.status <> 'INVALIDEE'
          and coalesce(btrim(aq.code_answer), '') <> ''
          and coalesce(aq.grading->>'status', '') <> 'done') as algo_to_review,
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
      algoToReview: r.status && FINISHED.includes(r.status) ? (r.algo_to_review ?? 0) : 0,
      released: r.released_at !== null,
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
      isAlgo: sql<boolean>`${questionVersions.algo} is not null`,
      isText: sql<boolean>`coalesce(${questionVersions.algo}->>'kind', '') = 'texte'`,
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
          isCorrect: attemptQuestions.isCorrect,
          hasCode: sql<boolean>`coalesce(btrim(${attemptQuestions.codeAnswer}), '') <> ''`,
          codeAnswer: attemptQuestions.codeAnswer,
          grading: attemptQuestions.grading,
          pointsAwarded: attemptQuestions.pointsAwarded,
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

  const nameByAttempt = new Map(
    students.filter((s) => s.attemptId).map((s) => [s.attemptId!, s.fullName]),
  );
  const questions = questionRows.map((q) => {
    const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
    const responses: QuestionResponse[] = (byQuestion.get(q.id) ?? [])
      // Question jamais affichée (copie soumise avant) : rien à analyser.
      .filter((a) => a.status !== "A_VENIR" && a.status !== "EN_COURS")
      .map((a) => ({
        studentScore: scoreByAttempt.get(a.attemptId) ?? 0,
        // Algorithme : « répondu » si du code a été rendu, réussite fixée par la correction.
        selectedOptionIds: q.isAlgo ? (a.hasCode ? ["code"] : []) : a.selectedOptionIds,
        // Calculé avec la clé actuelle (à jour après une correction).
        isCorrect:
          a.status === "NEUTRALISEE"
            ? null
            : q.isAlgo
              ? a.isCorrect === true
              : isExactMatch(a.selectedOptionIds, correctIds),
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
      isAlgo: q.isAlgo,
      algoKind: q.isAlgo ? (q.isText ? ("texte" as const) : ("algo" as const)) : undefined,
      points: q.points,
      durationSec: q.durationSec,
      neutralized: q.neutralizedAt !== null,
      algoCopies: q.isAlgo
        ? (byQuestion.get(q.id) ?? [])
            .filter((a) => a.status !== "A_VENIR" && a.status !== "EN_COURS")
            .map((a) => ({
              attemptId: a.attemptId,
              fullName: nameByAttempt.get(a.attemptId) ?? "Étudiant",
              code: (a.codeAnswer ?? "").slice(0, 8_000),
              pointsAwarded: a.pointsAwarded,
              grading: a.grading,
            }))
            .sort((x, y) => x.fullName.localeCompare(y.fullName, "fr"))
            .slice(0, 200)
        : undefined,
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
      algoToReview: students
        .filter((s) => s.algoToReview > 0 && s.attemptId)
        .map((s) => ({ attemptId: s.attemptId!, fullName: s.fullName, count: s.algoToReview })),
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
      algo: questionVersions.algo,
      codeAnswer: attemptQuestions.codeAnswer,
      grading: attemptQuestions.grading,
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
      algo: q.algo
        ? {
            kind: q.algo.kind === "texte" ? ("texte" as const) : ("algo" as const),
            code: q.codeAnswer,
            grading: q.grading,
            solution: q.algo.solution,
          }
        : null,
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
    released: a.releasedAt !== null,
    toValidate: questions.filter(
      (q) =>
        q.algo &&
        q.algo.code?.trim() &&
        q.algo.grading?.status !== "done" &&
        q.status !== "INVALIDEE",
    ).length,
    questions,
  };
}

export interface GradingQueueItem {
  attemptQuestionId: string;
  attemptId: string;
  fullName: string;
  questionNumber: number;
  prompt: string;
  kind: "algo" | "texte";
  answer: string;
  solution: string;
  points: number;
  pointsAwarded: number | null;
  grading: AlgoGrading | null;
}

/** File de correction : réponses libres (algorithme / rédaction) des copies terminées. */
export async function getGradingQueue(
  examId: string,
  onlyToValidate: boolean,
): Promise<GradingQueueItem[]> {
  const rows = await getDb()
    .select({
      attemptQuestionId: attemptQuestions.id,
      attemptId: attemptQuestions.attemptId,
      fullName: profiles.fullName,
      position: examQuestions.position,
      prompt: questionVersions.prompt,
      algo: questionVersions.algo,
      answer: attemptQuestions.codeAnswer,
      points: examQuestions.points,
      pointsAwarded: attemptQuestions.pointsAwarded,
      grading: attemptQuestions.grading,
      status: attemptQuestions.status,
    })
    .from(attemptQuestions)
    .innerJoin(attempts, eq(attempts.id, attemptQuestions.attemptId))
    .innerJoin(profiles, eq(profiles.id, attempts.studentId))
    .innerJoin(examQuestions, eq(examQuestions.id, attemptQuestions.examQuestionId))
    .innerJoin(questionVersions, eq(questionVersions.id, examQuestions.questionVersionId))
    .where(
      and(
        eq(attempts.examId, examId),
        sql`${attempts.status} not in ('EN_COURS', 'ANNULEE')`,
        sql`${questionVersions.algo} is not null`,
        sql`${attemptQuestions.status} <> 'INVALIDEE'`,
        sql`coalesce(btrim(${attemptQuestions.codeAnswer}), '') <> ''`,
        onlyToValidate
          ? sql`coalesce(${attemptQuestions.grading}->>'status', '') <> 'done'`
          : undefined,
      ),
    )
    .orderBy(asc(examQuestions.position), asc(profiles.fullName))
    .limit(500);
  return rows.map((r) => ({
    attemptQuestionId: r.attemptQuestionId,
    attemptId: r.attemptId,
    fullName: r.fullName,
    questionNumber: r.position + 1,
    prompt: r.prompt,
    kind: r.algo?.kind === "texte" ? "texte" : "algo",
    answer: (r.answer ?? "").slice(0, 12_000),
    solution: r.algo?.solution ?? "",
    points: r.points,
    pointsAwarded: r.pointsAwarded,
    grading: r.grading,
  }));
}
