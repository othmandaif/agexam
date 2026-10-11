"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { ROUTES, safeInternalPath } from "@/lib/routes";
import { eq } from "drizzle-orm";
import { currentAcademicYear } from "@/domain/academic-year";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { createSupabaseServerClient } from "@/server/supabase/server";
import { signInSchema, type SignInState } from "./schemas";

export async function signInAction(_prev: SignInState, formData: FormData): Promise<SignInState> {
  const raw = { email: formData.get("email"), password: formData.get("password") };
  const parsed = signInSchema.safeParse(raw);
  const email = typeof raw.email === "string" ? raw.email : undefined;

  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, email };
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Message volontairement générique : ne pas révéler si le compte existe.
    return { error: "Adresse e-mail ou mot de passe incorrect.", email };
  }

  // Identifiants corrects mais compte sans accès : message explicite, session fermée.
  const [profile] = await getDb()
    .select({
      role: profiles.role,
      isActive: profiles.isActive,
      academicYear: profiles.academicYear,
    })
    .from(profiles)
    .where(eq(profiles.id, data.user.id))
    .limit(1);
  const year = currentAcademicYear();
  if (!profile?.isActive || (profile.role === "ETUDIANT" && profile.academicYear !== year)) {
    await supabase.auth.signOut();
    return {
      error: !profile?.isActive
        ? "Ce compte est désactivé. Contactez l'administration."
        : `Votre compte n'est pas inscrit pour l'année ${year}. Contactez votre formateur ou l'administration.`,
      email,
    };
  }

  // "/" redirige vers l'espace correspondant au rôle.
  redirect(safeInternalPath(formData.get("next")) ?? "/");
}

export async function signOutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect(ROUTES.login);
}
