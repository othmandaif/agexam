import { z } from "zod";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `${max} caractères maximum.`)
    .optional()
    .transform((v) => (v ? v : null));

/** Date limite : ISO (convertie dans le navigateur depuis l'heure locale) ou vide. */
const dueAt = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Date limite invalide." });
      return z.NEVER;
    }
    return d;
  });

export const homeworkSchema = z.object({
  title: z.string().trim().min(1, "Titre requis.").max(120, "120 caractères maximum."),
  sessionLabel: optionalText(120),
  description: optionalText(2000),
  dueAt,
});

export const homeworkUpdateSchema = homeworkSchema.extend({
  homeworkId: z.uuid(),
  isPublished: z.boolean(),
  groupIds: z.array(z.uuid()).max(200),
});

export const homeworkIdSchema = z.object({ homeworkId: z.uuid() });
