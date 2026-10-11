import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, tsz, updatedAt } from "./_shared";
import { attemptQuestionStatusEnum, attemptStatusEnum } from "./enums";
import { examQuestions, exams } from "./exams";
import { profiles } from "./organization";

/** Tentative d'un étudiant. Toutes les heures viennent de l'horloge du serveur. */
export const attempts = pgTable(
  "attempts",
  {
    id: id(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    attemptNumber: integer("attempt_number").notNull().default(1),
    status: attemptStatusEnum("status").notNull().default("EN_COURS"),
    /** Position (0-based) de la question en cours dans l'ordre propre à cette tentative. */
    currentPosition: integer("current_position").notNull().default(0),
    /** Tiers-temps individuel. */
    timeMultiplier: numeric("time_multiplier", { precision: 4, scale: 2, mode: "number" })
      .notNull()
      .default(1),
    violationCount: integer("violation_count").notNull().default(0),
    networkNeutralizations: integer("network_neutralizations").notNull().default(0),
    /** Temps rendu après des coupures réseau (secondes) : chrono en pause pendant la coupure. */
    pausedSec: integer("paused_sec").notNull().default(0),
    startedAt: tsz("started_at").notNull().defaultNow(),
    /** Chrono GLOBAL : fin de la tentative (tiers-temps et fermeture inclus). */
    deadlineAt: tsz("deadline_at"),
    /** Onglet / appareil qui a la main sur la tentative (un seul à la fois). */
    sessionId: text("session_id"),
    submittedAt: tsz("submitted_at"),
    lastHeartbeatAt: tsz("last_heartbeat_at"),
    scoreAwarded: numeric("score_awarded", { precision: 8, scale: 2, mode: "number" }),
    scoreMax: numeric("score_max", { precision: 8, scale: 2, mode: "number" }),
    scoreOutOf20: numeric("score_out_of_20", { precision: 5, scale: 2, mode: "number" }),
    /** Référence lisible du reçu de soumission, ex. A7F3-91C2. */
    receiptCode: text("receipt_code").unique(),
    flaggedForReview: boolean("flagged_for_review").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("attempts_student_number_uq").on(t.examId, t.studentId, t.attemptNumber),
    index("attempts_exam_status_idx").on(t.examId, t.status),
    // Accueil étudiant, fiche étudiant : copies d'un étudiant.
    index("attempts_student_idx").on(t.studentId, t.startedAt),
    /** Une seule tentative en cours par étudiant et par examen. */
    uniqueIndex("attempts_one_active_uq")
      .on(t.examId, t.studentId)
      .where(sql`${t.status} = 'EN_COURS'`),
  ],
);

/**
 * Question telle que vue dans UNE tentative : ordre, ordre des options,
 * fenêtre de temps et réponse. L'ordre est figé au démarrage de la tentative.
 */
export const attemptQuestions = pgTable(
  "attempt_questions",
  {
    id: id(),
    attemptId: uuid("attempt_id")
      .notNull()
      .references(() => attempts.id, { onDelete: "cascade" }),
    examQuestionId: uuid("exam_question_id")
      .notNull()
      .references(() => examQuestions.id, { onDelete: "restrict" }),
    position: integer("position").notNull(),
    /** Identifiants d'options dans l'ordre affiché à cet étudiant. */
    optionOrder: jsonb("option_order").$type<string[]>().notNull(),
    status: attemptQuestionStatusEnum("status").notNull().default("A_VENIR"),
    shownAt: tsz("shown_at"),
    expiresAt: tsz("expires_at"),
    answeredAt: tsz("answered_at"),
    selectedOptionIds: jsonb("selected_option_ids")
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    isCorrect: boolean("is_correct"),
    pointsAwarded: numeric("points_awarded", { precision: 6, scale: 2, mode: "number" }),
    /** Sorties du mode examen pendant cette question (sanctions par question). */
    violationCount: integer("violation_count").notNull().default(0),
  },
  (t) => [
    uniqueIndex("attempt_questions_position_uq").on(t.attemptId, t.position),
    uniqueIndex("attempt_questions_question_uq").on(t.attemptId, t.examQuestionId),
    index("attempt_questions_exam_question_idx").on(t.examQuestionId),
  ],
);
