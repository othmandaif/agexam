import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { createdAt, id, tsz, updatedAt } from "./_shared";
import { establishments, groups, profiles } from "./organization";
import type { AlgoTestCase, AlgoTestResult } from "./training";

/** Image de la trace d'exécution rendue avec un devoir (voir domain/agsyntax/trace). */
export interface HandinTraceFrame {
  line: number;
  explain: string;
  vars: { name: string; type: string; value: string; items?: string[]; changed: boolean }[];
  output: string;
}

/** Devoir d'une séance à distance : problème découpé en étapes, avec date limite. */
export const homeworks = pgTable(
  "homeworks",
  {
    id: id(),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    /** Séance concernée (ex. « Séance du 14/11 — boucles »). */
    sessionLabel: text("session_label"),
    dueAt: tsz("due_at"),
    isPublished: boolean("is_published").notNull().default(false),
    academicYear: text("academic_year")
      .notNull()
      .default(sql`public.academic_year_of(now())`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("homeworks_year_idx").on(t.establishmentId, t.academicYear)],
);

export const homeworkGroups = pgTable(
  "homework_groups",
  {
    homeworkId: uuid("homework_id")
      .notNull()
      .references(() => homeworks.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.homeworkId, t.groupId] }),
    index("homework_groups_group_idx").on(t.groupId),
  ],
);

/** Étape : énoncé, code de départ, corrigé (jamais envoyé au stagiaire), jeux d'essai. */
export const homeworkSteps = pgTable(
  "homework_steps",
  {
    id: id(),
    homeworkId: uuid("homework_id")
      .notNull()
      .references(() => homeworks.id, { onDelete: "cascade" }),
    stepNo: integer("step_no").notNull().default(1),
    title: text("title").notNull(),
    statement: text("statement").notNull(),
    starterCode: text("starter_code").notNull().default(""),
    solutionCode: text("solution_code").notNull(),
    tests: jsonb("tests").$type<AlgoTestCase[]>().notNull().default([]),
    /** Code animé dans l'indice (vide : le corrigé). Les commentaires « // » servent d'explications. */
    hintCode: text("hint_code").notNull().default(""),
    /** Saisies de l'animation (null : celles du premier jeu visible). */
    hintInputs: jsonb("hint_inputs").$type<string[] | null>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("homework_steps_hw_idx").on(t.homeworkId, t.stepNo)],
);

export const homeworkSubmissions = pgTable(
  "homework_submissions",
  {
    id: id(),
    stepId: uuid("step_id")
      .notNull()
      .references(() => homeworkSteps.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    passed: boolean("passed").notNull(),
    passedCount: integer("passed_count").notNull(),
    totalCount: integer("total_count").notNull(),
    results: jsonb("results").$type<AlgoTestResult[]>().notNull().default([]),
    createdAt: createdAt(),
  },
  (t) => [index("homework_submissions_student_idx").on(t.studentId, t.stepId, t.createdAt)],
);

/** Indices animés ouverts par un stagiaire (nombre d'ouvertures par étape). */
export const homeworkHintViews = pgTable(
  "homework_hint_views",
  {
    stepId: uuid("step_id")
      .notNull()
      .references(() => homeworkSteps.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    views: integer("views").notNull().default(1),
    lastAt: tsz("last_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.stepId, t.studentId] })],
);

/** Rendu final : algorithme complet et sa trace. Aucune note. */
export const homeworkHandins = pgTable(
  "homework_handins",
  {
    homeworkId: uuid("homework_id")
      .notNull()
      .references(() => homeworks.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    trace: jsonb("trace").$type<HandinTraceFrame[]>().notNull().default([]),
    isLate: boolean("is_late").notNull().default(false),
    submittedAt: tsz("submitted_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.homeworkId, t.studentId] })],
);
