import { z } from "zod";
import { SANCTION_TYPES } from "./enums";

/**
 * Politique de violations : l'élément i s'applique à la (i+1)e violation.
 * Au-delà de la longueur du tableau, la dernière sanction s'applique.
 */
export const violationPolicySchema = z.array(z.enum(SANCTION_TYPES)).min(1).max(10);
export type ViolationPolicy = z.infer<typeof violationPolicySchema>;

/**
 * Sanctions par question : le compteur repart à zéro à chaque nouvelle question.
 * 1re sortie : avertissement ; 2e sortie sur la même question : question invalidée.
 */
export const DEFAULT_VIOLATION_POLICY: ViolationPolicy = ["AVERTISSEMENT", "INVALIDER_QUESTION"];

/** Réglages techniques de sécurité d'un examen (stockés en JSONB). */
export const securitySettingsSchema = z.object({
  /** Délai accepté après l'expiration d'une question, pour absorber la latence réseau. */
  answerToleranceSec: z.number().int().min(0).max(10),
  /** Fréquence du signal de présence envoyé par le navigateur. */
  heartbeatIntervalSec: z.number().int().min(5).max(60),
  /** Questions neutralisables pour coupure réseau, par tentative. */
  maxNetworkNeutralizations: z.number().int().min(0).max(5),
  /** Temps total rendu après des coupures réseau, par tentative (chrono en pause). */
  maxNetworkPauseSec: z.number().int().min(0).max(1_800),
  /** Événements rapprochés fusionnés en une seule violation. */
  eventMergeWindowMs: z.number().int().min(0).max(10_000),
  blockCopyPaste: z.boolean(),
  shuffleAnswers: z.boolean(),
});
export type SecuritySettings = z.infer<typeof securitySettingsSchema>;

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  answerToleranceSec: 3,
  heartbeatIntervalSec: 10,
  maxNetworkNeutralizations: 1,
  maxNetworkPauseSec: 600,
  eventMergeWindowMs: 2_000,
  blockCopyPaste: true,
  shuffleAnswers: true,
};

/** Une option de réponse, figée dans une version de question. */
export const questionOptionSchema = z.object({
  /** Identifiant interne stable (jamais A/B/C/D, qui changent avec le mélange). */
  id: z.string().min(1).max(36),
  label: z.string().min(1).max(2_000),
  isCorrect: z.boolean(),
  /** Option non mélangée, ex. « Aucune des réponses ». */
  fixedPosition: z.boolean().default(false),
});
export type QuestionOption = z.infer<typeof questionOptionSchema>;
