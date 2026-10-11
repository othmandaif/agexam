import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  DEFAULT_SECURITY_SETTINGS,
  DEFAULT_VIOLATION_POLICY,
  type SecuritySettings,
  type ViolationPolicy,
} from "@/domain/exam-settings";
import { createdAt, id, tsz, updatedAt } from "./_shared";
import {
  examStatusEnum,
  resultReleaseModeEnum,
  resultVisibilityEnum,
  timerModeEnum,
} from "./enums";
import { establishments, groups, modules, profiles } from "./organization";
import { questionVersions } from "./questions";

export const exams = pgTable(
  "exams",
  {
    id: id(),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id").references(() => modules.id, { onDelete: "set null" }),
    authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    /** Texte des questions tel que saisi par le formateur (pour le rééditer). */
    sourceText: text("source_text"),
    status: examStatusEnum("status").notNull().default("BROUILLON"),
    opensAt: tsz("opens_at"),
    closesAt: tsz("closes_at"),
    /** Code affiché en salle. Ne remplace pas l'appartenance au groupe. */
    accessCode: text("access_code"),
    maxAttempts: integer("max_attempts").notNull().default(1),
    /** PAR_QUESTION : durée propre à chaque question. GLOBAL : une durée pour tout l'examen. */
    timerMode: timerModeEnum("timer_mode").notNull().default("PAR_QUESTION"),
    /** Mode GLOBAL : durée totale en secondes (avant tiers-temps). */
    globalDurationSec: integer("global_duration_sec"),
    /** Points ajoutés à la note sur 20 de toute la classe (plafonnée à 20). */
    bonusPoints: numeric("bonus_points", { precision: 4, scale: 2, mode: "number" })
      .notNull()
      .default(0),
    /** Examen d'entraînement : non noté, tentatives illimitées. */
    isPractice: boolean("is_practice").notNull().default(false),
    violationPolicy: jsonb("violation_policy")
      .$type<ViolationPolicy>()
      .notNull()
      .default(DEFAULT_VIOLATION_POLICY),
    securitySettings: jsonb("security_settings")
      .$type<SecuritySettings>()
      .notNull()
      .default(DEFAULT_SECURITY_SETTINGS),
    resultVisibility: resultVisibilityEnum("result_visibility").notNull().default("NOTE"),
    resultReleaseMode: resultReleaseModeEnum("result_release_mode").notNull().default("MANUEL"),
    resultsPublishedAt: tsz("results_published_at"),
    /** Message diffusé à tous les étudiants pendant l'examen. */
    liveMessage: text("live_message"),
    liveMessageAt: tsz("live_message_at"),
    /** Année scolaire de l'examen (fixée à la création). */
    academicYear: text("academic_year")
      .notNull()
      .default(sql`public.academic_year_of(now())`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("exams_establishment_status_idx").on(t.establishmentId, t.status, t.opensAt),
    // Listes du formateur : ses examens.
    index("exams_author_idx").on(t.authorId),
    index("exams_year_idx").on(t.establishmentId, t.academicYear),
    uniqueIndex("exams_access_code_uq").on(t.establishmentId, t.accessCode),
  ],
);

/** Groupes autorisés à passer l'examen. */
export const examGroups = pgTable(
  "exam_groups",
  {
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.examId, t.groupId] }),
    index("exam_groups_group_idx").on(t.groupId),
  ],
);

/**
 * Étudiants ajoutés individuellement (rattrapage…), en plus des groupes :
 * ils peuvent passer l'examen même s'ils ne sont dans aucun groupe choisi.
 */
export const examCandidates = pgTable(
  "exam_candidates",
  {
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.examId, t.profileId] }),
    index("exam_candidates_profile_idx").on(t.profileId),
  ],
);

/** Questions de l'examen (liste fixe, mêmes questions pour tous), durée et barème. */
export const examQuestions = pgTable(
  "exam_questions",
  {
    id: id(),
    examId: uuid("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    questionVersionId: uuid("question_version_id")
      .notNull()
      .references(() => questionVersions.id, { onDelete: "restrict" }),
    /** Position de référence (avant mélange par tentative). */
    position: integer("position").notNull(),
    durationSec: integer("duration_sec").notNull(),
    points: numeric("points", { precision: 6, scale: 2, mode: "number" }).notNull().default(1),
    /** Neutralisation après coup (question erronée) : recalcul de toutes les notes. */
    neutralizedAt: tsz("neutralized_at"),
  },
  (t) => [
    uniqueIndex("exam_questions_position_uq").on(t.examId, t.position),
    uniqueIndex("exam_questions_version_uq").on(t.examId, t.questionVersionId),
  ],
);
