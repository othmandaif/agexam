"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { homePathFor, paths, ROUTES } from "@/lib/routes";
import { actionError } from "@/server/actions/result";
import { requireTenant, requireUser } from "@/server/auth/session";
import { studentScope } from "@/server/scope";
import { audit } from "@/server/audit";
import { supabaseAdmin } from "@/server/supabase/admin";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { AppError } from "@/server/http/errors";
import { createSupabaseServerClient } from "@/server/supabase/server";
import {
  changePasswordSchema,
  createAccountSchema,
  updateNameSchema,
  updateRoleSchema,
  userIdSchema,
} from "../schemas";
import {
  createAccount,
  resetAccountPassword,
  setAccountActive,
  updateAccountName,
  updateAccountRole,
} from "./service";

/** Identifiants à afficher UNE seule fois après création ou réinitialisation. */
export interface Credentials {
  fullName: string;
  email: string;
  tempPassword: string;
  userId: string;
}

type State = ActionState<unknown>;

/** Un formateur n'agit que sur les comptes étudiants de son établissement. */
async function assertStudentOfTenant(userId: string, establishmentId: string, viewerId: string) {
  const [row] = await getDb()
    .select({ role: profiles.role, establishmentId: profiles.establishmentId })
    .from(profiles)
    .where(and(eq(profiles.id, userId), studentScope(viewerId, "profiles")))
    .limit(1);
  if (!row || row.establishmentId !== establishmentId || row.role !== "ETUDIANT") {
    throw new AppError("FORBIDDEN", "Action réservée aux comptes étudiants.");
  }
}
type CredentialsState = ActionState<Credentials>;

export async function createAccountAction(
  _prev: CredentialsState,
  formData: FormData,
): Promise<CredentialsState> {
  try {
    const actor = await requireTenant("ADMIN", "FORMATEUR");
    const parsed = createAccountSchema.parse(Object.fromEntries(formData));
    // Un formateur ne crée que des comptes étudiants, dans un groupe existant de l'année.
    if (actor.role === "ADMIN" && parsed.role === "ETUDIANT") {
      throw new AppError("FORBIDDEN", "Les étudiants sont créés par les formateurs.");
    }
    const input = actor.role === "ADMIN" ? parsed : { ...parsed, role: "ETUDIANT" as const };
    if (actor.role !== "ADMIN" && !input.groupId) {
      throw new AppError("BAD_REQUEST", "Choisissez le groupe de l'étudiant.");
    }
    const { userId, tempPassword, reactivated } = await createAccount(actor, input);
    revalidatePath(ROUTES.admin.accounts);
    revalidatePath(ROUTES.trainer.students);
    return {
      status: "success",
      message: reactivated
        ? `${input.fullName} avait un compte d'une année passée : réinscrit pour cette année.`
        : `Compte créé pour ${input.fullName}.`,
      data: { userId, fullName: input.fullName, email: input.email, tempPassword },
    };
  } catch (error) {
    return actionError(error);
  }
}

/** Supprime définitivement un étudiant du formateur (compte, copies et résultats compris). */
export async function deleteStudentAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const actor = await requireTenant("FORMATEUR");
    const { userId } = userIdSchema.parse(Object.fromEntries(formData));
    await assertStudentOfTenant(userId, actor.establishmentId, actor.id);
    const { error } = await supabaseAdmin().auth.admin.deleteUser(userId);
    if (error) throw new AppError("INTERNAL", "Suppression impossible. Réessayez.");
    await getDb().transaction((tx) =>
      audit(tx, {
        actorId: actor.id,
        action: "account.delete",
        entityType: "profile",
        entityId: userId,
        payload: {},
      }),
    );
    revalidatePath(ROUTES.trainer.students);
    return { status: "success", message: "Étudiant supprimé." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateRoleAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const actor = await requireTenant("ADMIN");
    const { userId, role } = updateRoleSchema.parse(Object.fromEntries(formData));
    await updateAccountRole(actor, userId, role);
    revalidatePath(paths.account(userId));
    return { status: "success", message: "Rôle mis à jour." };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateNameAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const actor = await requireTenant("ADMIN");
    const { userId, fullName } = updateNameSchema.parse(Object.fromEntries(formData));
    await updateAccountName(actor, userId, fullName);
    revalidatePath(paths.account(userId));
    return { status: "success", message: "Nom mis à jour." };
  } catch (error) {
    return actionError(error);
  }
}

export async function setActiveAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const actor = await requireTenant("ADMIN");
    const { userId } = userIdSchema.parse(Object.fromEntries(formData));
    const active = formData.get("active") === "true";
    await setAccountActive(actor, userId, active);
    revalidatePath(paths.account(userId));
    return { status: "success", message: active ? "Compte réactivé." : "Compte désactivé." };
  } catch (error) {
    return actionError(error);
  }
}

export async function resetPasswordAction(
  _prev: CredentialsState,
  formData: FormData,
): Promise<CredentialsState> {
  try {
    const actor = await requireTenant("ADMIN", "FORMATEUR");
    const { userId } = userIdSchema.parse(Object.fromEntries(formData));
    if (actor.role !== "ADMIN") {
      await assertStudentOfTenant(userId, actor.establishmentId, actor.id);
    }
    const tempPassword = await resetAccountPassword(actor, userId);
    revalidatePath(paths.account(userId));
    return {
      status: "success",
      message: "Nouveau mot de passe provisoire généré.",
      data: {
        userId,
        tempPassword,
        fullName: String(formData.get("fullName") ?? ""),
        email: String(formData.get("email") ?? ""),
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

/** Changement de son propre mot de passe (obligatoire après un mot de passe provisoire). */
export async function changeOwnPasswordAction(_prev: State, formData: FormData): Promise<State> {
  let destination;
  try {
    const user = await requireUser();
    const { password } = changePasswordSchema.parse(Object.fromEntries(formData));
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      if (error.code === "same_password") {
        throw new AppError("BAD_REQUEST", "Choisissez un mot de passe différent du provisoire.");
      }
      if (error.code === "weak_password") {
        throw new AppError("BAD_REQUEST", "Mot de passe trop faible. Choisissez-en un plus long.");
      }
      console.error("[accounts] updateUser password", error);
      throw new AppError("INTERNAL", "Changement impossible. Réessayez.");
    }
    await getDb()
      .update(profiles)
      .set({ mustChangePassword: false })
      .where(eq(profiles.id, user.id));
    destination = homePathFor(user.role);
  } catch (error) {
    return actionError(error);
  }
  redirect(destination);
}
