import { z } from "zod";
import {
  RESULT_RELEASE_MODES,
  RESULT_VISIBILITIES,
  TIMER_MODES,
  type ResultReleaseMode,
  type ResultVisibility,
} from "@/domain/enums";
import { DEFAULT_VIOLATION_POLICY, violationPolicySchema } from "@/domain/exam-settings";

/** Réglages modifiables depuis l'éditeur (« Réglages avancés »). */
export const examSettingsSchema = z.object({
  violationPolicy: violationPolicySchema,
  resultVisibility: z.enum(RESULT_VISIBILITIES),
  resultReleaseMode: z.enum(RESULT_RELEASE_MODES),
  shuffleAnswers: z.boolean(),
  blockCopyPaste: z.boolean(),
  /** Algorithmes : notes proposées, validées par le formateur avant de compter. */
  validateAlgoGrades: z.boolean().default(true),
  /** Entraînement : sans surveillance ni code, tentatives illimitées, correction immédiate. */
  isPractice: z.boolean().default(false),
  /** Chrono par question (durées du texte) ou durée unique pour tout l'examen. */
  timerMode: z.enum(TIMER_MODES).default("PAR_QUESTION"),
  /** Mode GLOBAL : 1 min à 6 h. */
  globalDurationSec: z
    .number()
    .int()
    .min(60, "1 minute minimum.")
    .max(6 * 3600, "6 heures maximum.")
    .nullable()
    .default(null),
});
export type ExamSettings = z.infer<typeof examSettingsSchema>;

export const DEFAULT_EXAM_SETTINGS: ExamSettings = {
  violationPolicy: DEFAULT_VIOLATION_POLICY,
  resultVisibility: "NOTE",
  resultReleaseMode: "IMMEDIAT",
  shuffleAnswers: true,
  blockCopyPaste: true,
  validateAlgoGrades: true,
  isPractice: false,
  timerMode: "PAR_QUESTION",
  globalDurationSec: null,
};

const optionalIsoDate = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Date invalide." });
      return z.NEVER;
    }
    return d;
  });

export const saveExamSchema = z
  .object({
    examId: z
      .union([z.uuid(), z.literal("")])
      .optional()
      .transform((v) => v || null),
    /** save : garder le statut actuel. publish : publier. */
    intent: z.enum(["save", "publish"]),
    title: z
      .string()
      .trim()
      .min(3, "Donnez un nom à l'examen (3 caractères minimum).")
      .max(160, "160 caractères maximum."),
    description: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => v || null),
    moduleId: z.uuid({ error: "Choisissez un module." }),
    groupIds: z.array(z.uuid()).max(50),
    /** Étudiants ajoutés hors groupes (rattrapage…). */
    candidateIds: z.array(z.uuid()).max(300, "300 étudiants ajoutés maximum.").default([]),
    opensAt: optionalIsoDate,
    closesAt: optionalIsoDate,
    sourceText: z.string().max(200_000, "Texte trop long."),
    settings: examSettingsSchema,
  })
  .refine((v) => v.groupIds.length + v.candidateIds.length > 0, {
    path: ["groupIds"],
    message: "Choisissez au moins un groupe ou ajoutez un étudiant.",
  });
export type SaveExamInput = z.infer<typeof saveExamSchema>;

export const examIdSchema = z.object({ examId: z.uuid() });

export const VISIBILITY_LABELS: Record<ResultVisibility, { title: string; hint: string }> = {
  AUCUNE: { title: "Rien", hint: "Reçu de soumission seulement" },
  NOTE: { title: "Note seule", hint: "Note sur 20 et pourcentage" },
  NOTE_DETAIL: { title: "Note et détail", hint: "Bonnes, mauvaises, sans réponse" },
  CORRECTION: { title: "Correction complète", hint: "Chaque question avec l'explication" },
};

export const RELEASE_LABELS: Record<ResultReleaseMode, string> = {
  IMMEDIAT: "À la fin de l'examen",
  APRES_FERMETURE: "Après la fermeture",
  MANUEL: "Quand j'envoie les notes",
};

/** Étudiant ajouté individuellement à un examen (affichage dans l'éditeur). */
export interface StudentPick {
  id: string;
  fullName: string;
  email: string;
  groups: string;
}
