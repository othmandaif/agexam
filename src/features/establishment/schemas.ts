import { z } from "zod";

export const establishmentSchema = z.object({
  name: z.string().trim().min(2, "2 caractères minimum.").max(120, "120 caractères maximum."),
});

export const moduleSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Code requis.")
    .max(20, "20 caractères maximum.")
    .transform((v) => v.toUpperCase()),
  name: z.string().trim().min(2, "2 caractères minimum.").max(120, "120 caractères maximum."),
});

export const moduleUpdateSchema = moduleSchema.extend({ moduleId: z.uuid() });

export const chapterSchema = z.object({
  moduleId: z.uuid(),
  name: z.string().trim().min(1, "Nom requis.").max(120, "120 caractères maximum."),
});

export const chapterUpdateSchema = z.object({
  chapterId: z.uuid(),
  name: chapterSchema.shape.name,
});

export const idSchema = (key: string) => z.object({ [key]: z.uuid() });
