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
import { createdAt, id, updatedAt } from "./_shared";
import { establishments, groups, profiles } from "./organization";

/** Jeu d'essai : saisies (une par LIRE) et sortie attendue, figée depuis le corrigé. */
export interface AlgoTestCase {
  inputs: string[];
  expected: string;
  /** Caché : l'étudiant voit seulement réussi / échoué. */
  hidden: boolean;
}

/** Résultat d'un jeu d'essai pour une soumission. */
export interface AlgoTestResult {
  passed: boolean;
  hidden: boolean;
  inputs?: string[];
  expected?: string;
  got?: string;
  error?: string;
}

/** Parcours d'entraînement algorithmique (ex. « Boucles »), visible par des groupes. */
export const algoTracks = pgTable(
  "algo_tracks",
  {
    id: id(),
    establishmentId: uuid("establishment_id")
      .notNull()
      .references(() => establishments.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => profiles.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    description: text("description"),
    isPublished: boolean("is_published").notNull().default(false),
    academicYear: text("academic_year")
      .notNull()
      .default(sql`public.academic_year_of(now())`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("algo_tracks_year_idx").on(t.establishmentId, t.academicYear)],
);

export const algoTrackGroups = pgTable(
  "algo_track_groups",
  {
    trackId: uuid("track_id")
      .notNull()
      .references(() => algoTracks.id, { onDelete: "cascade" }),
    groupId: uuid("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.trackId, t.groupId] }),
    index("algo_track_groups_group_idx").on(t.groupId),
  ],
);

/** Exercice : énoncé, code de départ, corrigé (jamais envoyé à l'étudiant), jeux d'essai. */
export const algoExercises = pgTable(
  "algo_exercises",
  {
    id: id(),
    trackId: uuid("track_id")
      .notNull()
      .references(() => algoTracks.id, { onDelete: "cascade" }),
    level: integer("level").notNull().default(1),
    position: integer("position").notNull().default(0),
    title: text("title").notNull(),
    statement: text("statement").notNull(),
    starterCode: text("starter_code").notNull().default(""),
    solutionCode: text("solution_code").notNull(),
    tests: jsonb("tests").$type<AlgoTestCase[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("algo_exercises_track_idx").on(t.trackId, t.level, t.position)],
);

/** Soumission d'un étudiant, testée côté serveur. */
export const algoSubmissions = pgTable(
  "algo_submissions",
  {
    id: id(),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => algoExercises.id, { onDelete: "cascade" }),
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
  (t) => [index("algo_submissions_student_idx").on(t.studentId, t.exerciseId, t.createdAt)],
);
