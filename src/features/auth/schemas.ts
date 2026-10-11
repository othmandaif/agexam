import { z } from "zod";

export const signInSchema = z.object({
  email: z.email("Adresse e-mail invalide.").trim().toLowerCase(),
  password: z.string().min(1, "Mot de passe requis."),
});

export type SignInInput = z.infer<typeof signInSchema>;

export interface SignInState {
  error?: string;
  fieldErrors?: Partial<Record<keyof SignInInput, string[]>>;
  email?: string;
}
