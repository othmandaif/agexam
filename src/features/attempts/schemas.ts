import { z } from "zod";
import { SECURITY_EVENT_TYPES } from "@/domain/enums";

export const attemptParamsSchema = z.object({ attemptId: z.uuid() });

/** En-tête envoyé par l'onglet d'examen : un seul onglet / appareil a la main. */
export const ATTEMPT_SESSION_HEADER = "x-attempt-session";

export function attemptSessionFrom(req: Request): string | undefined {
  const value = req.headers.get(ATTEMPT_SESSION_HEADER)?.trim();
  return value && /^[A-Za-z0-9-]{8,64}$/.test(value) ? value : undefined;
}

export const answerSchema = z.object({
  attemptQuestionId: z.uuid(),
  selectedOptionIds: z.array(z.string().min(1).max(36)).max(10),
});

export const eventsSchema = z.object({
  events: z
    .array(
      z.object({
        // OTHER_DEVICE est écrit par le serveur seulement.
        type: z.enum(SECURITY_EVENT_TYPES).exclude(["OTHER_DEVICE"]),
        at: z.string().max(40),
        attemptQuestionId: z.uuid().nullable().optional(),
        awayMs: z.number().int().min(0).max(86_400_000).nullable().optional(),
      }),
    )
    .min(1)
    .max(20),
});

export const accessCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6}$/, "Le code contient 6 caractères.");
