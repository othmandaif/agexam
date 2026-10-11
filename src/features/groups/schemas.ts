import { z } from "zod";

export const groupSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nom requis.")
    .max(40, "40 caractères maximum.")
    .transform((v) => v.toUpperCase()),
  label: z
    .string()
    .trim()
    .max(120, "120 caractères maximum.")
    .optional()
    .transform((v) => (v ? v : null)),
});

export const groupUpdateSchema = groupSchema.extend({ groupId: z.uuid() });

export const groupIdSchema = z.object({ groupId: z.uuid() });

export const membersSchema = z.object({
  groupId: z.uuid(),
  profileIds: z.array(z.uuid()).min(1, "Sélectionnez au moins un étudiant.").max(500),
});

export const memberSchema = z.object({ groupId: z.uuid(), profileId: z.uuid() });
