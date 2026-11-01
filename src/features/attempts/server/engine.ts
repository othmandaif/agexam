import "server-only";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import {
  isMultipleAnswer,
  planAttempt,
  questionDeadline,
  resolveExpiredQuestion,
  selectionError,
  formatReceiptCode,
} from "@/domain/attempt-rules";
import type { AttemptQuestionStatus, AttemptStatus, SanctionType } from "@/domain/enums";
import { examPhase } from "@/domain/exam-lifecycle";
import { DEFAULT_SECURITY_SETTINGS, type QuestionOption } from "@/domain/exam-settings";
import { algoRatio, type AlgoGrading } from "@/domain/algo-grading";
import { isExactMatch, scoreAttempt, scoreQuestion } from "@/domain/scoring";
import { isViolationEvent, sanctionFor, shouldMergeIntoIncident } from "@/domain/violations";
import type { TenantUser } from "@/server/auth/session";
import { getDb, type Database } from "@/server/db/client";
import { isEnrolledSql } from "@/server/db/enrolment";
import {
  attemptQuestions,
  attempts,
  examQuestions,
  exams,
  incidents,
  questionVersions,
  securityEvents,
  type AlgoQuestionData,
} from "@/server/db/schema";
import { scheduleAlgoGrading } from "./algo-grader";
import { AppError, errors } from "@/server/http/errors";
import type {
  AttemptClientState,
  ClientSecurityEvent,
  EventsResponse,
  PracticeFeedback,
  ProgressCell,
} from "../types";

type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];
type ExamRow = typeof exams.$inferSelect;
type AttemptRow = typeof attempts.$inferSelect;

interface QuestionRow {
  id: string;
  position: number;
  optionOrder: string[];
  status: AttemptQuestionStatus;
  shownAt: Date | null;
  expiresAt: Date | null;
  selectedOptionIds: string[];
  durationSec: number;
  points: number;
  /** Question neutralisée par le formateur pour tout l'examen (erreur d'énoncé). */
  neutralized: boolean;
  prompt: string;
  code: string | null;
  codeLanguage: (typeof questionVersions.$inferSelect)["codeLanguage"];
  options: QuestionOption[];
  explanation: string | null;
  /** Sorties du mode examen pendant cette question. */
  violationCount: number;
  /** Question d'algorithme : corrigé + jeux d'essai (jamais envoyés au navigateur). */
  algo: AlgoQuestionData | null;
  codeAnswer: string | null;
  grading: AlgoGrading | null;
}

/** Réponse donnée : case(s) cochée(s), ou algorithme non vide. */
const hasAnswer = (q: Pick<QuestionRow, "algo" | "codeAnswer" | "selectedOptionIds">) =>
  q.algo ? !!q.codeAnswer?.trim() : q.selectedOptionIds.length > 0;

export const MAX_CODE_LENGTH = 20_000;

/** Contexte d'une requête : tentative verrouillée (FOR UPDATE) + examen + questions. */
interface Ctx {
  tx: Tx;
  now: Date;
  attempt: AttemptRow;
  exam: ExamRow;
  questions: QuestionRow[];
  /**
   * Écritures différées : envoyées d'un seul bloc (pipeline) par flush().
   * L'état en mémoire (attempt, questions) est la source de vérité pendant la requête.
   */
  writes: PromiseLike<unknown>[];
  attemptPatch: Partial<AttemptRow>;
  /** Une seule mise à jour par question : l'ordre d'exécution du pipeline n'importe plus. */
  questionPatches: Map<string, Record<string, unknown>>;
  /** Requête de l'onglet de l'étudiant (sinon : synchro déclenchée par le formateur). */
  studentRequest: boolean;
}

const settingsOf = (exam: ExamRow) => ({ ...DEFAULT_SECURITY_SETTINGS, ...exam.securitySettings });

const ACTIVE: AttemptStatus = "EN_COURS";

// ─── Chargement ──────────────────────────────────────────────────────────────

/** studentId null : accès formateur, dont les droits sur l'examen ont été vérifiés avant. */
async function loadContext(tx: Tx, attemptId: string, studentId: string | null): Promise<Ctx> {
  // Les deux lectures partent ensemble (pipeline postgres-js) : un seul aller-retour.
  // L'ordre est garanti : le verrou FOR UPDATE est posé avant la lecture des questions.
  const lockQuery = tx
    .select({ attempt: attempts, exam: exams })
    .from(attempts)
    .innerJoin(exams, eq(exams.id, attempts.examId))
    .where(
      and(eq(attempts.id, attemptId), studentId ? eq(attempts.studentId, studentId) : undefined),
    )
    .for("update", { of: attempts })
    .limit(1);
  const questionsQuery = tx
    .select({
      id: attemptQuestions.id,
      position: attemptQuestions.position,
      optionOrder: attemptQuestions.optionOrder,
      status: attemptQuestions.status,
      shownAt: attemptQuestions.shownAt,
      expiresAt: attemptQuestions.expiresAt,
      selectedOptionIds: attemptQuestions.selectedOptionIds,
      durationSec: examQuestions.durationSec,
      points: examQuestions.points,
      neutralized: sql<boolean>`${examQuestions.neutralizedAt} is not null`,
      prompt: questionVersions.prompt,
      code: questionVersions.code,
      codeLanguage: questionVersions.codeLanguage,
      options: questionVersions.options,
      explanation: questionVersions.explanation,
      violationCount: attemptQuestions.violationCount,
      algo: questionVersions.algo,
      codeAnswer: attemptQuestions.codeAnswer,
      grading: attemptQuestions.grading,
    })
    .from(attemptQuestions)
    .innerJoin(examQuestions, eq(examQuestions.id, attemptQuestions.examQuestionId))
    .innerJoin(questionVersions, eq(questionVersions.id, examQuestions.questionVersionId))
    .where(eq(attemptQuestions.attemptId, attemptId))
    .orderBy(asc(attemptQuestions.position));
  const [[row], questions] = await Promise.all([lockQuery, questionsQuery]);
  if (!row) throw errors.notFound("Tentative introuvable.");

  return {
    tx,
    now: new Date(),
    attempt: row.attempt,
    exam: row.exam,
    questions: questions as QuestionRow[],
    writes: [],
    attemptPatch: {},
    questionPatches: new Map(),
    studentRequest: false,
  };
}

/**
 * Envoie les écritures différées en un seul aller-retour. Chaque ligne n'est
 * écrite qu'une fois (patchs fusionnés) et les notes (storeScores) touchent
 * d'autres colonnes : l'ordre d'exécution est sans effet sur le résultat.
 */
async function flush(ctx: Ctx) {
  for (const [id, patch] of ctx.questionPatches) {
    ctx.writes.push(ctx.tx.update(attemptQuestions).set(patch).where(eq(attemptQuestions.id, id)));
  }
  ctx.questionPatches.clear();
  if (Object.keys(ctx.attemptPatch).length > 0) {
    ctx.writes.push(
      ctx.tx.update(attempts).set(ctx.attemptPatch).where(eq(attempts.id, ctx.attempt.id)),
    );
    ctx.attemptPatch = {};
  }
  const writes = ctx.writes;
  ctx.writes = [];
  if (writes.length > 0) await Promise.all(writes);
}

/** Charge le contexte, exécute fn, puis écrit tout d'un coup. */
async function inContext<T>(
  tx: Tx,
  attemptId: string,
  studentId: string | null,
  fn: (ctx: Ctx) => Promise<T>,
): Promise<T> {
  const ctx = await loadContext(tx, attemptId, studentId);
  const result = await fn(ctx);
  await flush(ctx);
  return result;
}

const current = (ctx: Ctx) => {
  const q = ctx.questions[ctx.attempt.currentPosition];
  return q && q.status === "EN_COURS" ? q : null;
};

/** Entraînement : correction affichée, question suivante pas encore démarrée. */
const isPracticePause = (ctx: Ctx) =>
  ctx.exam.isPractice &&
  ctx.attempt.status === ACTIVE &&
  ctx.questions[ctx.attempt.currentPosition]?.status === "A_VENIR";

const isGlobalTimer = (ctx: Ctx) => ctx.exam.timerMode === "GLOBAL";

/** Chrono global écoulé (sans tolérance). */
const globalTimeOver = (ctx: Ctx) =>
  isGlobalTimer(ctx) && !!ctx.attempt.deadlineAt && ctx.now >= ctx.attempt.deadlineAt;

/** Échéance d'une question qui s'ouvre : la sienne, ou la fin globale de la tentative. */
function deadlineFor(ctx: Ctx, q: QuestionRow): Date {
  if (isGlobalTimer(ctx) && ctx.attempt.deadlineAt) return ctx.attempt.deadlineAt;
  return questionDeadline(ctx.now, q.durationSec, ctx.attempt.timeMultiplier, ctx.exam.closesAt);
}

/** Chrono global écoulé : la question en cours est close, les suivantes ne sont jamais vues. */
async function expireGlobally(ctx: Ctx) {
  await closeCurrentWithSavedAnswer(ctx);
  for (const q of ctx.questions) {
    if (q.status === "A_VENIR") await setQuestion(ctx, q, { status: "EXPIREE" });
  }
  await submit(ctx, "EXPIREE");
}

// ─── Transitions ─────────────────────────────────────────────────────────────

async function setQuestion(
  ctx: Ctx,
  q: QuestionRow,
  patch: Partial<
    Pick<
      QuestionRow,
      | "status"
      | "selectedOptionIds"
      | "shownAt"
      | "expiresAt"
      | "violationCount"
      | "codeAnswer"
      | "grading"
    >
  > & {
    answeredAt?: Date;
  },
) {
  Object.assign(q, patch);
  ctx.questionPatches.set(q.id, { ...ctx.questionPatches.get(q.id), ...patch });
}

async function setAttempt(ctx: Ctx, patch: Partial<AttemptRow>) {
  Object.assign(ctx.attempt, patch);
  Object.assign(ctx.attemptPatch, patch);
}

/** Ouvre la question suivante (le chrono démarre maintenant) ou termine la tentative. */
async function openNext(ctx: Ctx) {
  const nextPosition = ctx.attempt.currentPosition + 1;
  const next = ctx.questions[nextPosition];
  if (!next) {
    await submit(ctx, "SOUMISE");
    return;
  }
  // Chrono global écoulé : aucune autre question ne s'ouvre.
  if (globalTimeOver(ctx)) {
    await expireGlobally(ctx);
    return;
  }
  await setAttempt(ctx, { currentPosition: nextPosition });
  // Entraînement : pause pour lire la correction ; la question suivante démarre
  // quand l'étudiant clique « Continuer » (continuePractice).
  if (ctx.exam.isPractice) return;
  await setQuestion(ctx, next, {
    status: "EN_COURS",
    shownAt: ctx.now,
    expiresAt: deadlineFor(ctx, next),
  });
}

/** Clôt la question en cours avec ce qui a été enregistré. */
async function closeCurrentWithSavedAnswer(ctx: Ctx) {
  const cur = current(ctx);
  if (!cur) return;
  await setQuestion(ctx, cur, {
    status: hasAnswer(cur) ? "REPONDUE" : "EXPIREE",
  });
}

/** Statut pris en compte pour la note : la neutralisation d'examen prime. */
const scoringStatus = (q: QuestionRow): AttemptQuestionStatus =>
  q.neutralized ? "NEUTRALISEE" : q.status;

/** Calcule et enregistre la note de chaque question et de la tentative. */
async function storeScores(ctx: Ctx) {
  const inputs = ctx.questions.map((q) => ({
    status: scoringStatus(q),
    selectedOptionIds: q.selectedOptionIds,
    correctOptionIds: q.options.filter((o) => o.isCorrect).map((o) => o.id),
    points: q.points,
    optionCount: q.options.length,
    // Algorithme : part fixée par la correction (0 provisoire si en attente).
    ...(q.algo ? { ratio: algoRatio(q.grading) } : {}),
  }));
  const scored = ctx.questions.map((q, i) => {
    const s = scoreQuestion(inputs[i]!);
    return { id: q.id, isCorrect: s.isCorrect, points: s.awarded };
  });
  const total = scoreAttempt(inputs);

  if (scored.length > 0) {
    ctx.writes.push(
      ctx.tx.execute(sql`
      update ${attemptQuestions} as aq
      set is_correct = v.is_correct, points_awarded = v.points
      from (values ${sql.join(
        scored.map((r) => sql`(${r.id}::uuid, ${r.isCorrect}::boolean, ${r.points}::numeric)`),
        sql`, `,
      )}) as v(id, is_correct, points)
      where aq.id = v.id
    `),
    );
  }

  // Bonus de classe (fixé par le formateur), note plafonnée à 20.
  const bonus = Number(ctx.exam.bonusPoints ?? 0);
  const outOf20 =
    total.outOf20 === null || bonus === 0
      ? total.outOf20
      : Math.min(20, Math.round((total.outOf20 + bonus) * 100) / 100);
  await setAttempt(ctx, {
    scoreAwarded: total.awarded,
    scoreMax: total.max,
    scoreOutOf20: outOf20,
  });
}

/** Termine la tentative : notation, reçu. Les algorithmes rendus partent en correction. */
async function submit(ctx: Ctx, status: Exclude<AttemptStatus, "EN_COURS" | "ANNULEE">) {
  let toGrade = false;
  for (const q of ctx.questions) {
    if (q.algo && hasAnswer(q) && !q.grading && q.status !== "INVALIDEE") {
      await setQuestion(ctx, q, { grading: { status: "pending" } });
      toGrade = true;
    }
  }
  if (toGrade) scheduleAlgoGrading(ctx.attempt.id);
  await storeScores(ctx);
  await setAttempt(ctx, {
    status,
    submittedAt: ctx.now,
    currentPosition: ctx.questions.length,
    receiptCode:
      ctx.attempt.receiptCode ??
      formatReceiptCode(globalThis.crypto.getRandomValues(new Uint8Array(4))),
    ...(status === "SOUMISE_AUTO" ? { flaggedForReview: true } : {}),
  });
}

/**
 * Rattrape le temps écoulé depuis la dernière requête : questions expirées,
 * coupures réseau, fermeture de l'examen. Appelé au début de CHAQUE requête,
 * avant de mettre à jour « dernier signe de vie ».
 */
async function sync(ctx: Ctx) {
  if (ctx.attempt.status !== ACTIVE) return;
  const settings = settingsOf(ctx.exam);
  // Synchro sans l'étudiant (pages du formateur) : on lui laisse le temps de
  // revenir d'une coupure réseau avant de clore sa question.
  const toleranceMs =
    settings.answerToleranceSec * 1000 + (ctx.studentRequest ? 0 : pauseLeftMs(ctx));

  for (let guard = 0; guard <= ctx.questions.length; guard++) {
    // Fermeture de l'examen (date passée ou fermeture manuelle) : tout s'arrête.
    if (examPhase(ctx.exam, ctx.now) === "FERME") {
      await closeCurrentWithSavedAnswer(ctx);
      await submit(ctx, "EXPIREE");
      return;
    }
    // Chrono global : à l'échéance (+ tolérance réseau), tout s'arrête avec ce qui est enregistré.
    if (
      isGlobalTimer(ctx) &&
      ctx.attempt.deadlineAt &&
      ctx.now.getTime() > ctx.attempt.deadlineAt.getTime() + toleranceMs
    ) {
      await expireGlobally(ctx);
      return;
    }
    const cur = current(ctx);
    if (!cur) {
      if (isPracticePause(ctx)) return;
      await submit(ctx, "SOUMISE");
      return;
    }
    if (!cur.expiresAt || ctx.now.getTime() <= cur.expiresAt.getTime() + toleranceMs) return;

    const { outcome, connectionLost } = resolveExpiredQuestion({
      selectedCount: hasAnswer(cur) ? 1 : 0,
      shownAt: cur.shownAt ?? cur.expiresAt,
      expiresAt: cur.expiresAt,
      lastSeenAt: ctx.attempt.lastHeartbeatAt,
      heartbeatIntervalSec: settings.heartbeatIntervalSec,
      neutralizationsUsed: ctx.attempt.networkNeutralizations,
      maxNeutralizations: settings.maxNetworkNeutralizations,
    });
    await setQuestion(ctx, cur, { status: outcome });
    if (outcome === "NEUTRALISEE") {
      await setAttempt(ctx, { networkNeutralizations: ctx.attempt.networkNeutralizations + 1 });
    } else if (connectionLost) {
      await setAttempt(ctx, { flaggedForReview: true });
    }
    await openNext(ctx);
    if (ctx.attempt.status !== ACTIVE) return;
  }
}

// ─── État envoyé au navigateur ───────────────────────────────────────────────

const CELL: Record<AttemptQuestionStatus, ProgressCell> = {
  A_VENIR: "upcoming",
  EN_COURS: "current",
  REPONDUE: "answered",
  EXPIREE: "expired",
  INVALIDEE: "invalidated",
  NEUTRALISEE: "neutralized",
};

/** Correction de la dernière question close (entraînement uniquement). */
function practiceFeedback(ctx: Ctx): PracticeFeedback | null {
  if (!ctx.exam.isPractice) return null;
  const finished = ctx.attempt.status !== ACTIVE;
  if (!finished && !isPracticePause(ctx)) return null;
  const q = [...ctx.questions]
    .reverse()
    .find((x) => x.status !== "A_VENIR" && x.status !== "EN_COURS");
  if (!q) return null;
  const byId = new Map(q.options.map((o) => [o.id, o]));
  const correctIds = q.options.filter((o) => o.isCorrect).map((o) => o.id);
  return {
    number: q.position + 1,
    prompt: q.prompt,
    status: q.status,
    options: q.optionOrder
      .map((id) => byId.get(id))
      .filter((o): o is QuestionOption => !!o)
      .map((o) => ({ id: o.id, label: o.label, isCorrect: o.isCorrect })),
    selectedOptionIds: q.selectedOptionIds,
    correct:
      q.status === "NEUTRALISEE" || q.neutralized || q.algo
        ? null
        : q.status !== "INVALIDEE" && isExactMatch(q.selectedOptionIds, correctIds),
    explanation: q.explanation,
  };
}

function buildState(ctx: Ctx): AttemptClientState {
  const settings = settingsOf(ctx.exam);
  const cur = ctx.attempt.status === ACTIVE ? current(ctx) : null;
  const byId = cur ? new Map(cur.options.map((o) => [o.id, o])) : null;

  return {
    attemptId: ctx.attempt.id,
    examTitle: ctx.exam.title,
    finished: ctx.attempt.status !== ACTIVE,
    practice: ctx.exam.isPractice,
    feedback: practiceFeedback(ctx),
    serverNow: ctx.now.toISOString(),
    total: ctx.questions.length,
    timerMode: ctx.exam.timerMode,
    progress: ctx.questions.map((q) => CELL[q.status]),
    message:
      ctx.exam.liveMessage && ctx.exam.liveMessageAt
        ? { text: ctx.exam.liveMessage, at: ctx.exam.liveMessageAt.toISOString() }
        : null,
    violationCount: ctx.attempt.violationCount,
    // Sanctions par question : le compteur repart à zéro à chaque question.
    nextSanction: sanctionFor(ctx.exam.violationPolicy, (cur?.violationCount ?? 0) + 1),
    questionViolations: cur?.violationCount ?? 0,
    settings: {
      blockCopyPaste: settings.blockCopyPaste,
      algoValidation: settings.validateAlgoGrades ?? true,
      heartbeatIntervalSec: settings.heartbeatIntervalSec,
      answerToleranceSec: settings.answerToleranceSec,
      pauseLeftSec: Math.round(pauseLeftMs(ctx) / 1000),
    },
    question:
      cur && byId && cur.shownAt && cur.expiresAt
        ? {
            attemptQuestionId: cur.id,
            number: cur.position + 1,
            prompt: cur.prompt,
            code: cur.code,
            codeLanguage: cur.codeLanguage,
            // Ordre propre à l'étudiant, sans « isCorrect ».
            options: cur.algo
              ? []
              : cur.optionOrder
                  .map((id) => byId.get(id))
                  .filter((o): o is QuestionOption => !!o)
                  .map((o) => ({ id: o.id, label: o.label })),
            multiple: !cur.algo && isMultipleAnswer(cur.options),
            kind: cur.algo ? (cur.algo.kind === "texte" ? "texte" : "algo") : "choice",
            codeAnswer: cur.algo
              ? cur.algo.kind === "texte"
                ? (cur.codeAnswer ?? "")
                : (cur.codeAnswer ?? cur.code ?? "")
              : null,
            points: cur.points,
            // Chrono global : la barre de temps porte sur toute la tentative.
            durationSec: Math.round(
              (cur.expiresAt.getTime() -
                (isGlobalTimer(ctx) ? ctx.attempt.startedAt : cur.shownAt).getTime()) /
                1000,
            ),
            shownAt: cur.shownAt.toISOString(),
            expiresAt: cur.expiresAt.toISOString(),
            selectedOptionIds: cur.selectedOptionIds,
          }
        : null,
  };
}

// ─── Points d'entrée ─────────────────────────────────────────────────────────

/**
 * Un seul onglet / appareil à la fois. Celui qui a la main reste maître tant
 * qu'il donne signe de vie ; un autre n'est accepté qu'après ce délai (fenêtre
 * fermée, PC planté) et la reprise est signalée au formateur.
 */
async function claimSession(ctx: Ctx, sessionId: string) {
  if (ctx.attempt.status !== ACTIVE || ctx.attempt.sessionId === sessionId) return;
  if (ctx.attempt.sessionId) {
    const settings = settingsOf(ctx.exam);
    const takeoverMs = settings.heartbeatIntervalSec * 2_000 + 10_000;
    const lastSeen = ctx.attempt.lastHeartbeatAt?.getTime() ?? 0;
    if (ctx.now.getTime() - lastSeen < takeoverMs) {
      throw new AppError(
        "CONFLICT",
        "Cet examen est déjà ouvert sur un autre appareil ou un autre onglet.",
        { reason: "SESSION_ELSEWHERE", retryInSec: Math.ceil(takeoverMs / 1000) },
      );
    }
    await ctx.tx.insert(securityEvents).values({
      attemptId: ctx.attempt.id,
      attemptQuestionId: current(ctx)?.id ?? null,
      type: "OTHER_DEVICE",
      serverAt: ctx.now,
    });
    await setAttempt(ctx, { flaggedForReview: true });
  }
  await setAttempt(ctx, { sessionId });
}

/**
 * Coupure réseau : pas de plafond. La question en cours est bloquée (chrono en
 * pause, question masquée côté étudiant) jusqu'au retour du réseau ; seule la
 * fermeture de l'examen arrête la tentative. Aucune question n'est sautée.
 */
const pauseLeftMs = (ctx: Ctx) => {
  const closes = ctx.exam.closesAt?.getTime();
  return closes ? Math.max(0, closes - ctx.now.getTime()) : 7 * 24 * 3_600_000;
};

/**
 * Coupure réseau : le chrono est mis en pause. Au retour de l'étudiant, le temps
 * passé sans signe de vie (moins un intervalle de présence) est rendu à la
 * question en cours (et à la fin globale), dans la limite du crédit de
 * l'examen. La coupure est journalisée, sans sanction ni signalement.
 */
async function creditOutage(ctx: Ctx) {
  const settings = settingsOf(ctx.exam);
  const last = ctx.attempt.lastHeartbeatAt;
  const cur = current(ctx);
  if (ctx.attempt.status !== ACTIVE || !last || !cur?.expiresAt) return;
  const intervalMs = settings.heartbeatIntervalSec * 1000;
  const gapMs = ctx.now.getTime() - last.getTime();
  if (gapMs <= intervalMs * 1.5) return;
  const creditMs = Math.min(gapMs - intervalMs, pauseLeftMs(ctx));
  if (creditMs < 1000) return;
  const cap = ctx.exam.closesAt?.getTime() ?? Number.POSITIVE_INFINITY;
  const push = (d: Date) => new Date(Math.min(d.getTime() + creditMs, cap));
  await setQuestion(ctx, cur, { expiresAt: push(cur.expiresAt) });
  if (isGlobalTimer(ctx) && ctx.attempt.deadlineAt) {
    await setAttempt(ctx, { deadlineAt: push(ctx.attempt.deadlineAt) });
  }
  await setAttempt(ctx, { pausedSec: ctx.attempt.pausedSec + Math.round(creditMs / 1000) });
  await ctx.tx.insert(securityEvents).values([
    { attemptId: ctx.attempt.id, attemptQuestionId: cur.id, type: "NETWORK_LOST", serverAt: last },
    {
      attemptId: ctx.attempt.id,
      attemptQuestionId: cur.id,
      type: "NETWORK_RESTORED",
      serverAt: ctx.now,
    },
  ]);
}

/** Ouvre une transaction sur la tentative, rattrape le temps, exécute fn, note le signe de vie. */
async function withAttempt<T>(
  student: TenantUser,
  attemptId: string,
  fn: (ctx: Ctx) => Promise<T>,
  sessionId?: string,
  presence = true,
) {
  return getDb().transaction((tx) =>
    inContext(tx, attemptId, student.id, async (ctx) => {
      // Requête de l'étudiant (pas la lecture de rendu de page).
      ctx.studentRequest = presence;
      if (sessionId) {
        // Onglet de l'étudiant : prise de main, puis temps rendu après une coupure,
        // AVANT de clore une question qui aurait expiré pendant la coupure.
        await claimSession(ctx, sessionId);
        await creditOutage(ctx);
      }
      await sync(ctx);
      const result = await fn(ctx);
      if (presence && ctx.attempt.status === ACTIVE) {
        await setAttempt(ctx, { lastHeartbeatAt: ctx.now });
      }
      return result;
    }),
  );
}

export function getAttemptState(student: TenantUser, attemptId: string, sessionId?: string) {
  return withAttempt(student, attemptId, async (ctx) => buildState(ctx), sessionId);
}

export const heartbeat = getAttemptState;

/**
 * Lecture pour le rendu serveur de la page d'examen : ni prise de main, ni signe
 * de vie (seul l'onglet qui appelle l'API compte), et sans le contenu de la
 * question, chargé ensuite par l'onglet autorisé.
 */
export function peekAttemptState(student: TenantUser, attemptId: string) {
  return withAttempt(
    student,
    attemptId,
    async (ctx) => ({ ...buildState(ctx), question: null }),
    undefined,
    false,
  );
}

function checkSelection(q: QuestionRow, selected: string[]) {
  const err = selectionError(selected, q.optionOrder, isMultipleAnswer(q.options));
  if (err) throw errors.badRequest(err);
}

/** Enregistre la sélection en cours (chaque clic). */
export function saveAnswer(
  student: TenantUser,
  attemptId: string,
  input: { attemptQuestionId: string; selectedOptionIds: string[] },
  sessionId?: string,
) {
  return withAttempt(
    student,
    attemptId,
    async (ctx) => {
      const cur = current(ctx);
      if (!cur || cur.id !== input.attemptQuestionId || ctx.attempt.status !== ACTIVE) {
        return { accepted: false, state: buildState(ctx) };
      }
      checkSelection(cur, input.selectedOptionIds);
      await setQuestion(ctx, cur, {
        selectedOptionIds: input.selectedOptionIds,
        answeredAt: ctx.now,
      });
      return { accepted: true, state: buildState(ctx) };
    },
    sessionId,
  );
}

/** Question d'algorithme : enregistre le code en cours (sauvegarde régulière). */
export function saveCode(
  student: TenantUser,
  attemptId: string,
  input: { attemptQuestionId: string; code: string },
  sessionId?: string,
) {
  return withAttempt(
    student,
    attemptId,
    async (ctx) => {
      const cur = current(ctx);
      if (!cur || cur.id !== input.attemptQuestionId || ctx.attempt.status !== ACTIVE) {
        return { accepted: false, state: buildState(ctx) };
      }
      if (!cur.algo) throw errors.badRequest("Cette question n'attend pas de réponse rédigée.");
      await setQuestion(ctx, cur, {
        codeAnswer: input.code.slice(0, MAX_CODE_LENGTH),
        answeredAt: ctx.now,
      });
      return { accepted: true, state: buildState(ctx) };
    },
    sessionId,
  );
}

/** Valide la question en cours et passe à la suivante (idempotent). */
export function nextQuestion(
  student: TenantUser,
  attemptId: string,
  input: { attemptQuestionId: string; selectedOptionIds: string[]; code?: string },
  sessionId?: string,
) {
  return withAttempt(
    student,
    attemptId,
    async (ctx) => {
      const cur = current(ctx);
      if (cur && cur.id === input.attemptQuestionId && ctx.attempt.status === ACTIVE) {
        if (cur.algo) {
          if (input.code !== undefined) {
            await setQuestion(ctx, cur, { codeAnswer: input.code.slice(0, MAX_CODE_LENGTH) });
          }
          await setQuestion(ctx, cur, {
            status: hasAnswer(cur) ? "REPONDUE" : "EXPIREE",
            answeredAt: ctx.now,
          });
        } else {
          checkSelection(cur, input.selectedOptionIds);
          await setQuestion(ctx, cur, {
            selectedOptionIds: input.selectedOptionIds,
            status: input.selectedOptionIds.length > 0 ? "REPONDUE" : "EXPIREE",
            answeredAt: ctx.now,
          });
        }
        await openNext(ctx);
      } else if (input.code?.trim()) {
        await rescueLateCode(ctx, input.attemptQuestionId, input.code);
      }
      return buildState(ctx);
    },
    sessionId,
  );
}

/** Délai accordé à un algorithme envoyé juste après la clôture de sa question (chrono, réseau). */
const LATE_CODE_GRACE_MS = 90_000;

/**
 * Validation arrivée après la clôture de la question (chrono écoulé pendant
 * l'envoi) : le code n'est pas perdu s'il arrive dans le délai de grâce et
 * qu'aucun code n'avait été enregistré.
 */
async function rescueLateCode(ctx: Ctx, attemptQuestionId: string, code: string) {
  const q = ctx.questions.find((x) => x.id === attemptQuestionId);
  if (!q?.algo || hasAnswer(q) || q.status !== "EXPIREE" || !q.expiresAt) return;
  const settings = settingsOf(ctx.exam);
  const limit = q.expiresAt.getTime() + settings.answerToleranceSec * 1000 + LATE_CODE_GRACE_MS;
  if (ctx.now.getTime() > limit) return;
  await setQuestion(ctx, q, {
    codeAnswer: code.slice(0, MAX_CODE_LENGTH),
    status: "REPONDUE",
    answeredAt: ctx.now,
  });
  if (ctx.attempt.status !== ACTIVE) {
    await setQuestion(ctx, q, { grading: { status: "pending" } });
    scheduleAlgoGrading(ctx.attempt.id);
    await storeScores(ctx);
  }
}

/** Entraînement : démarre la question suivante après la lecture de la correction. */
export function continuePractice(student: TenantUser, attemptId: string, sessionId?: string) {
  return withAttempt(
    student,
    attemptId,
    async (ctx) => {
      if (isPracticePause(ctx)) {
        const next = ctx.questions[ctx.attempt.currentPosition]!;
        if (globalTimeOver(ctx)) {
          await expireGlobally(ctx);
        } else {
          await setQuestion(ctx, next, {
            status: "EN_COURS",
            shownAt: ctx.now,
            expiresAt: deadlineFor(ctx, next),
          });
        }
      }
      return buildState(ctx);
    },
    sessionId,
  );
}

/** Journalise les événements navigateur et applique la politique de violations (par question). */
export function recordEvents(
  student: TenantUser,
  attemptId: string,
  events: ClientSecurityEvent[],
  sessionId?: string,
): Promise<EventsResponse> {
  return withAttempt(
    student,
    attemptId,
    async (ctx) => {
      const settings = settingsOf(ctx.exam);
      let sanction: EventsResponse["sanction"] = null;

      for (const event of events) {
        const cur = current(ctx);
        const clientAt = new Date(event.at);
        let incidentId: string | null = null;

        // Entraînement : pas de surveillance, aucune sanction.
        if (
          ctx.attempt.status === ACTIVE &&
          !ctx.exam.isPractice &&
          isViolationEvent(event.type, event.awayMs)
        ) {
          const [lastViolation] = await ctx.tx
            .select({ incidentId: securityEvents.incidentId, at: securityEvents.serverAt })
            .from(securityEvents)
            .where(
              and(
                eq(securityEvents.attemptId, ctx.attempt.id),
                isNotNull(securityEvents.incidentId),
              ),
            )
            .orderBy(desc(securityEvents.serverAt))
            .limit(1);

          if (
            lastViolation &&
            shouldMergeIntoIncident(lastViolation.at, ctx.now, settings.eventMergeWindowMs)
          ) {
            incidentId = lastViolation.incidentId;
          } else {
            // Total de l'examen (suivi du formateur) et compteur de la question (sanction).
            const violationNumber = ctx.attempt.violationCount + 1;
            const onQuestion = (cur?.violationCount ?? 0) + 1;
            const type: SanctionType = cur
              ? sanctionFor(ctx.exam.violationPolicy, onQuestion)
              : "AUCUNE";
            const [created] = await ctx.tx
              .insert(incidents)
              .values({
                attemptId: ctx.attempt.id,
                attemptQuestionId: cur?.id ?? null,
                violationNumber,
                sanction: type,
                startedAt: ctx.now,
              })
              .returning({ id: incidents.id });
            incidentId = created!.id;
            await setAttempt(ctx, { violationCount: violationNumber });
            if (cur) await setQuestion(ctx, cur, { violationCount: onQuestion });
            sanction = { type, violationNumber: onQuestion };
            await applySanction(ctx, type);
          }
        }

        if (event.type === "FULLSCREEN_ENTER") {
          await ctx.tx
            .update(incidents)
            .set({ endedAt: ctx.now })
            .where(and(eq(incidents.attemptId, ctx.attempt.id), isNull(incidents.endedAt)));
        }

        await ctx.tx.insert(securityEvents).values({
          attemptId: ctx.attempt.id,
          attemptQuestionId: event.attemptQuestionId ?? cur?.id ?? null,
          incidentId,
          type: event.type,
          clientAt: Number.isNaN(clientAt.getTime()) ? null : clientAt,
          serverAt: ctx.now,
        });
      }
      return { state: buildState(ctx), sanction };
    },
    sessionId,
  );
}

async function applySanction(ctx: Ctx, type: SanctionType) {
  if (type === "INVALIDER_QUESTION") {
    const cur = current(ctx);
    if (cur) {
      await setQuestion(ctx, cur, { status: "INVALIDEE" });
      await openNext(ctx);
    }
  } else if (type === "SOUMISSION_AUTO") {
    await closeCurrentWithSavedAnswer(ctx);
    await submit(ctx, "SOUMISE_AUTO");
  }
  // AVERTISSEMENT, PENALITE, AUCUNE : journalisé, rien d'autre.
}

// ─── Démarrage ───────────────────────────────────────────────────────────────

const MOBILE_UA = /Android|iPhone|iPad|iPod|Mobile|Windows Phone/i;

export interface StartResult {
  attemptId: string;
  resumed: boolean;
}

/** Vérifie l'accès et crée la tentative (ou reprend celle en cours). */
export async function startAttempt(
  student: TenantUser,
  input: { examId: string; accessCode: string; userAgent: string | null },
): Promise<StartResult> {
  try {
    return await startAttemptTx(student, input);
  } catch (error) {
    // Double clic : l'index unique « une seule tentative en cours » a bloqué le second démarrage.
    const code =
      (error as { cause?: { code?: string }; code?: string })?.cause?.code ??
      (error as { code?: string })?.code;
    if (code === "23505") return startAttemptTx(student, input);
    throw error;
  }
}

async function startAttemptTx(
  student: TenantUser,
  input: { examId: string; accessCode: string; userAgent: string | null },
): Promise<StartResult> {
  return getDb().transaction(async (tx) => {
    const now = new Date();
    const [exam] = await tx
      .select()
      .from(exams)
      .where(and(eq(exams.id, input.examId), eq(exams.establishmentId, student.establishmentId)))
      .limit(1);
    if (!exam) throw errors.notFound("Examen introuvable.");

    const [enrolled] = (await tx.execute(
      sql`select ${isEnrolledSql(exam.id, student.id)} as ok`,
    )) as unknown as { ok: boolean }[];
    if (!enrolled?.ok) throw errors.forbidden("Cet examen ne vous est pas destiné.");

    const previous = await tx
      .select({ id: attempts.id, status: attempts.status })
      .from(attempts)
      .where(and(eq(attempts.examId, exam.id), eq(attempts.studentId, student.id)));
    const active = previous.find((a) => a.status === ACTIVE);
    if (active) return { attemptId: active.id, resumed: true };

    const phase = examPhase(exam, now);
    if (phase === "PLANIFIE") throw errors.conflict("L'examen n'est pas encore ouvert.");
    if (phase !== "OUVERT") throw errors.conflict("L'examen est fermé.");
    // Une tentative annulée par le formateur ne compte pas : l'étudiant peut repasser.
    // Entraînement : sans code d'accès et sans limite de tentatives.
    if (
      !exam.isPractice &&
      previous.filter((a) => a.status !== "ANNULEE").length >= exam.maxAttempts
    )
      throw errors.conflict("Vous avez déjà passé cet examen.");
    if (
      !exam.isPractice &&
      (!exam.accessCode || input.accessCode.trim().toUpperCase() !== exam.accessCode)
    ) {
      throw errors.badRequest("Code d'accès incorrect.");
    }
    if (input.userAgent && MOBILE_UA.test(input.userAgent)) {
      throw errors.forbidden("L'examen se passe uniquement sur ordinateur.");
    }
    if (exam.closesAt && exam.closesAt.getTime() - now.getTime() < 60_000) {
      throw errors.conflict("L'examen ferme dans moins d'une minute.");
    }

    const questionRows = await tx
      .select({
        id: examQuestions.id,
        durationSec: examQuestions.durationSec,
        options: questionVersions.options,
      })
      .from(examQuestions)
      .innerJoin(questionVersions, eq(questionVersions.id, examQuestions.questionVersionId))
      .where(eq(examQuestions.examId, exam.id));
    if (questionRows.length === 0) throw errors.conflict("Cet examen ne contient aucune question.");

    const settings = settingsOf(exam);
    const plan = planAttempt(questionRows, { shuffleAnswers: settings.shuffleAnswers });
    // Chrono global : une seule échéance pour toute la tentative.
    const deadlineAt =
      exam.timerMode === "GLOBAL" && exam.globalDurationSec
        ? questionDeadline(now, exam.globalDurationSec, 1, exam.closesAt)
        : null;
    const durations = new Map(questionRows.map((q) => [q.id, q.durationSec]));
    const attemptId = crypto.randomUUID();

    await tx.insert(attempts).values({
      id: attemptId,
      examId: exam.id,
      studentId: student.id,
      attemptNumber: previous.length + 1,
      status: ACTIVE,
      currentPosition: 0,
      startedAt: now,
      lastHeartbeatAt: now,
      deadlineAt,
    });
    await tx.insert(attemptQuestions).values(
      plan.map((p) => ({
        attemptId,
        examQuestionId: p.examQuestionId,
        position: p.position,
        optionOrder: p.optionOrder,
        status: p.position === 0 ? ("EN_COURS" as const) : ("A_VENIR" as const),
        shownAt: p.position === 0 ? now : null,
        expiresAt:
          p.position === 0
            ? (deadlineAt ??
              questionDeadline(now, durations.get(p.examQuestionId)!, 1, exam.closesAt))
            : null,
      })),
    );
    return { attemptId, resumed: false };
  });
}

/** Rattrape le temps d'une tentative sans requête du navigateur (pages résultat, suivi). */
export async function syncAttemptIfActive(student: TenantUser, attemptId: string) {
  return getDb().transaction((tx) =>
    inContext(tx, attemptId, student.id, async (ctx) => {
      await sync(ctx);
      return ctx.attempt.status;
    }),
  );
}

// ─── Côté formateur ──────────────────────────────────────────────────────────

const lastExamSync = new Map<string, number>();

/**
 * Rattrape le temps des tentatives d'un examen dont l'étudiant ne fait plus de
 * requêtes (navigateur fermé, coupure) : questions expirées, fermeture.
 * Limité à un passage toutes les 3 s par examen et par instance.
 */
export async function syncExamAttempts(examId: string) {
  const nowMs = Date.now();
  if (nowMs - (lastExamSync.get(examId) ?? 0) < 3_000) return;
  lastExamSync.set(examId, nowMs);

  // Les requêtes SQL brutes ne convertissent pas les Date : on passe une chaîne ISO typée.
  const now = sql`${new Date(nowMs).toISOString()}::timestamptz`;
  const db = getDb();
  const rows = (await db.execute(sql`
    select a.id
    from ${attempts} a
    join ${exams} e on e.id = a.exam_id
    left join ${attemptQuestions} cq on cq.attempt_id = a.id and cq.status = 'EN_COURS'
    where a.exam_id = ${examId}
      and a.status = 'EN_COURS'
      and (
        e.status = 'FERME'
        or (e.closes_at is not null and e.closes_at <= ${now})
        or cq.id is null
        or cq.expires_at + make_interval(secs => coalesce((e.security_settings->>'answerToleranceSec')::int, 3)) < ${now}
      )
  `)) as unknown as { id: string }[];

  // Tentatives indépendantes : traitées 5 par 5 en parallèle (pool de connexions limité).
  for (let i = 0; i < rows.length; i += 5) {
    await Promise.all(
      rows.slice(i, i + 5).map(({ id }) => db.transaction((tx) => inContext(tx, id, null, sync))),
    );
  }
}

/**
 * Annule une sanction. Effets :
 * - le compteur de sorties diminue (la prochaine sortie reprend l'escalade) ;
 * - question invalidée : elle retrouve la réponse enregistrée ;
 * - soumission automatique : si l'examen est encore ouvert, la tentative reprend
 *   à la question suivante ; sinon elle reste terminée, sans sanction ;
 * - la note est recalculée si la tentative est terminée.
 */
export async function revokeIncident(
  staffId: string,
  incident: {
    id: string;
    attemptId: string;
    attemptQuestionId: string | null;
    sanction: SanctionType;
  },
): Promise<{ reopened: boolean }> {
  return getDb().transaction((tx) =>
    inContext(tx, incident.attemptId, null, async (ctx) => {
      let reopened = false;

      await tx
        .update(incidents)
        .set({ revokedAt: ctx.now, revokedBy: staffId })
        .where(and(eq(incidents.id, incident.id), isNull(incidents.revokedAt)));
      await setAttempt(ctx, { violationCount: Math.max(0, ctx.attempt.violationCount - 1) });

      if (incident.sanction === "INVALIDER_QUESTION" && incident.attemptQuestionId) {
        const q = ctx.questions.find((x) => x.id === incident.attemptQuestionId);
        if (q && q.status === "INVALIDEE") {
          await setQuestion(ctx, q, {
            status: hasAnswer(q) ? "REPONDUE" : "EXPIREE",
          });
        }
      }
      // Le compteur de la question baisse aussi (la prochaine sortie reprend l'escalade).
      if (incident.attemptQuestionId) {
        const q = ctx.questions.find((x) => x.id === incident.attemptQuestionId);
        if (q && q.violationCount > 0) {
          await setQuestion(ctx, q, { violationCount: q.violationCount - 1 });
        }
      }

      if (incident.sanction === "SOUMISSION_AUTO" && ctx.attempt.status === "SOUMISE_AUTO") {
        const next = ctx.questions.find((q) => q.status === "A_VENIR");
        if (next && examPhase(ctx.exam, ctx.now) === "OUVERT" && !globalTimeOver(ctx)) {
          await setAttempt(ctx, {
            status: ACTIVE,
            submittedAt: null,
            currentPosition: next.position,
            lastHeartbeatAt: ctx.now,
          });
          await setQuestion(ctx, next, {
            status: "EN_COURS",
            shownAt: ctx.now,
            expiresAt: deadlineFor(ctx, next),
          });
          reopened = true;
        } else {
          await setAttempt(ctx, { status: "SOUMISE" });
        }
      }

      if (ctx.attempt.status !== ACTIVE) await storeScores(ctx);
      return { reopened };
    }),
  );
}

/** Ajoute du temps à la question en cours d'un étudiant (incident technique…). */
export async function addTimeToCurrentQuestion(attemptId: string, seconds: number): Promise<Date> {
  return getDb().transaction((tx) =>
    inContext(tx, attemptId, null, async (ctx) => {
      await sync(ctx);
      const cur = ctx.attempt.status === ACTIVE ? current(ctx) : null;
      if (!cur?.expiresAt) throw errors.conflict("Cet étudiant n'a pas de question en cours.");
      let expiresAt = new Date(cur.expiresAt.getTime() + seconds * 1000);
      if (ctx.exam.closesAt && expiresAt > ctx.exam.closesAt) expiresAt = ctx.exam.closesAt;
      if (expiresAt.getTime() <= cur.expiresAt.getTime()) {
        throw errors.conflict(
          "La fermeture de l'examen est atteinte : prolongez d'abord l'examen.",
        );
      }
      await setQuestion(ctx, cur, { expiresAt });
      // Chrono global : c'est la fin de la tentative qui recule.
      if (isGlobalTimer(ctx)) await setAttempt(ctx, { deadlineAt: expiresAt });
      return expiresAt;
    }),
  );
}

/**
 * Recalcule la note de toutes les copies terminées d'un examen (après neutralisation
 * ou correction de la clé). Les copies en cours seront notées à la soumission avec
 * les nouvelles règles. À appeler dans la transaction qui a fait la modification.
 */
export async function rescoreExam(tx: Tx, examId: string): Promise<number> {
  const rows = await tx
    .select({ id: attempts.id })
    .from(attempts)
    .where(
      and(eq(attempts.examId, examId), sql`${attempts.status} not in ('EN_COURS', 'ANNULEE')`),
    );
  for (const { id } of rows) {
    await inContext(tx, id, null, storeScores);
  }
  return rows.length;
}

/** Recalcule la note d'une copie terminée (après la correction d'un algorithme). */
export async function rescoreAttempt(tx: Tx, attemptId: string): Promise<void> {
  await inContext(tx, attemptId, null, async (ctx) => {
    if (ctx.attempt.status !== ACTIVE && ctx.attempt.status !== "ANNULEE") await storeScores(ctx);
  });
}

export type { Tx as EngineTx };
