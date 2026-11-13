import { z } from "zod";
import { MAX_TESTS } from "@/domain/agsyntax/testing";

export const trackSchema = z.object({
  title: z.string().trim().min(1, "Titre requis.").max(120, "120 caractères maximum."),
  description: z
    .string()
    .trim()
    .max(600, "600 caractères maximum.")
    .optional()
    .transform((v) => (v ? v : null)),
});

export const trackUpdateSchema = trackSchema.extend({
  trackId: z.uuid(),
  isPublished: z.boolean(),
  groupIds: z.array(z.uuid()).max(200),
});

export const trackIdSchema = z.object({ trackId: z.uuid() });

const testInputSchema = z.object({
  /** Une valeur par LIRE, dans l'ordre. */
  inputs: z.array(z.string().max(500)).max(100),
  hidden: z.boolean(),
});

export const exerciseSchema = z.object({
  exerciseId: z.uuid().optional(),
  trackId: z.uuid(),
  level: z.coerce.number().int().min(1, "Niveau ≥ 1.").max(50, "Niveau ≤ 50."),
  title: z.string().trim().min(1, "Titre requis.").max(120, "120 caractères maximum."),
  statement: z.string().trim().min(1, "Énoncé requis.").max(8000, "Énoncé trop long."),
  starterCode: z.string().max(20000).default(""),
  solutionCode: z.string().trim().min(1, "Corrigé requis.").max(20000, "Corrigé trop long."),
  tests: z
    .array(testInputSchema)
    .min(1, "Ajoutez au moins un jeu d'essai.")
    .max(MAX_TESTS, `${MAX_TESTS} jeux d'essai maximum.`),
  /** Devoirs à distance : code animé de l'indice (vide : le corrigé) et ses saisies. */
  hintCode: z.string().max(20000, "Indice trop long.").default(""),
  hintInputs: z.array(z.string().max(500)).max(100).nullable().default(null),
});
export type ExerciseInput = z.infer<typeof exerciseSchema>;

export const exerciseIdSchema = z.object({ exerciseId: z.uuid() });

export const submissionSchema = z.object({
  exerciseId: z.uuid(),
  code: z.string().min(1, "Écrivez votre algorithme.").max(20000, "Algorithme trop long."),
});
