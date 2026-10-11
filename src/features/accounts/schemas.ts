import { z } from "zod";
import { USER_ROLES, type UserRole } from "@/domain/enums";

export const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: "Administrateur",
  FORMATEUR: "Formateur",
  ETUDIANT: "Étudiant",
};

export const emailField = z.string().trim().toLowerCase().pipe(z.email("Adresse e-mail invalide."));

export const fullNameField = z
  .string()
  .trim()
  .min(2, "2 caractères minimum.")
  .max(120, "120 caractères maximum.");

export const createAccountSchema = z.object({
  fullName: fullNameField,
  email: emailField,
  role: z.enum(USER_ROLES, "Rôle invalide."),
  groupId: z
    .union([z.uuid(), z.literal("")])
    .optional()
    .transform((v) => v || null),
});
export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const userIdSchema = z.object({ userId: z.uuid() });

export const updateRoleSchema = z.object({
  userId: z.uuid(),
  role: z.enum(USER_ROLES, "Rôle invalide."),
});

export const updateNameSchema = z.object({ userId: z.uuid(), fullName: fullNameField });

export const accountFiltersSchema = z.object({
  role: z.enum(USER_ROLES).optional().catch(undefined),
  q: z.string().trim().max(100).optional().catch(undefined),
});

export const changePasswordSchema = z
  .object({
    password: z
      .string()
      .min(10, "10 caractères minimum.")
      .max(72, "72 caractères maximum.")
      .regex(/[a-z]/, "Au moins une minuscule.")
      .regex(/[A-Z]/, "Au moins une majuscule.")
      .regex(/\d/, "Au moins un chiffre."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    path: ["confirm"],
    message: "Les deux mots de passe sont différents.",
  });
