import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { QuestionOption } from "@/domain/exam-settings";
import { createdAt, id, tsz, updatedAt } from "./_shared";

export interface AlgoQuestionData {
  /** « texte » : question directe / rédaction (réponse attendue dans `solution`, pas de jeux). */
  kind?: "algo" | "texte";
  solution: string;
  tests: { inputs: string[]; expected: string }[];
}
import { codeLanguageEnum, difficultyEnum, questionTypeEnum } from "./enums";
import { chapters, establishments, modules, profiles } from "./organization";

/** Question de la banque : métadonnées stables. Le contenu est dans question_versions. */
export const questions = pgTable(
  "questions",
  {
    id: id(),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    moduleId: uuid("module_id")
      .notNull()
      .references(() => modules.id, { onDelete: "restrict" }),
    chapterId: uuid("chapter_id").references(() => chapters.id, { onDelete: "set null" }),
    authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),
    type: questionTypeEnum("type").notNull(),
    difficulty: difficultyEnum("difficulty").notNull().default("MOYENNE"),
    currentVersion: integer("current_version").notNull().default(1),
    suggestedDurationSec: integer("suggested_duration_sec").notNull().default(45),
    /**
     * Examen dans lequel la question a été saisie (format texte). Permet de
     * nettoyer les questions d'un brouillon réenregistré. Pas de FK : évite
     * une dépendance circulaire entre schémas ; la cohérence est gérée par le service.
     */
    originExamId: uuid("origin_exam_id"),
    archivedAt: tsz("archived_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("questions_origin_exam_idx").on(t.originExamId),
    index("questions_filter_idx").on(
      t.establishmentId,
      t.moduleId,
      t.chapterId,
      t.type,
      t.difficulty,
    ),
  ],
);

/**
 * Version IMMUABLE d'une question. Modifier une question crée une nouvelle version :
 * les examens passés gardent la leur, les notes historiques ne bougent pas.
 * Les bonnes réponses (options[].isCorrect) ne quittent jamais le serveur.
 */
export const questionVersions = pgTable(
  "question_versions",
  {
    id: id(),
    questionId: uuid("question_id")
      .notNull()
      .references(() => questions.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    prompt: text("prompt").notNull(),
    code: text("code"),
    codeLanguage: codeLanguageEnum("code_language"),
    options: jsonb("options").$type<QuestionOption[]>().notNull(),
    explanation: text("explanation"),
    /** Question d'algorithme : corrigé et jeux d'essai figés (jamais envoyés au navigateur). */
    algo: jsonb("algo").$type<AlgoQuestionData>(),
    defaultPoints: numeric("default_points", { precision: 6, scale: 2, mode: "number" })
      .notNull()
      .default(1),
    /**
     * md5 du texte canonique (domain/question-fingerprint) : retrouve une question
     * identique déjà en banque quand un examen est enregistré.
     */
    fingerprint: text("fingerprint"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("question_versions_uq").on(t.questionId, t.version),
    index("question_versions_fingerprint_idx").on(t.fingerprint),
  ],
);
