import "server-only";
import { and, eq } from "drizzle-orm";
import { currentAcademicYear } from "@/domain/academic-year";
import type { UserRole } from "@/domain/enums";
import { audit } from "@/server/audit";
import type { TenantUser } from "@/server/auth/session";
import { generateTempPassword } from "@/server/auth/temp-password";
import { getDb } from "@/server/db/client";
import { groupMembers, groups, profiles } from "@/server/db/schema";
import { AppError, errors } from "@/server/http/errors";
import { supabaseAdmin } from "@/server/supabase/admin";

/** Durée de blocage Supabase pour un compte désactivé (≈ 100 ans). */
const BAN_FOREVER = "876000h";

export interface NewAccount {
  fullName: string;
  email: string;
  role: UserRole;
  groupId: string | null;
}

export interface CreatedAccount {
  userId: string;
  tempPassword: string;
  /** Compte d'une année passée réinscrit (pas de nouveau compte). */
  reactivated?: boolean;
}

function isEmailTaken(error: { code?: string; status?: number; message?: string }): boolean {
  return (
    error.code === "email_exists" ||
    error.code === "user_already_exists" ||
    /already (been )?registered|already exists/i.test(error.message ?? "")
  );
}

/** Groupe de l'établissement ET de l'année courante (on n'inscrit pas dans le passé). */
async function assertGroupInTenant(groupId: string, establishmentId: string) {
  const [row] = await getDb()
    .select({ id: groups.id })
    .from(groups)
    .where(
      and(
        eq(groups.id, groupId),
        eq(groups.establishmentId, establishmentId),
        eq(groups.academicYear, currentAcademicYear()),
      ),
    )
    .limit(1);
  if (!row) throw errors.notFound("Groupe introuvable pour l'année en cours.");
}

/**
 * Étudiant d'une année passée (même établissement) : réinscrit pour l'année
 * courante avec un nouveau mot de passe provisoire, au lieu d'un doublon.
 */
async function reactivateStudent(
  actor: TenantUser,
  input: NewAccount,
): Promise<(CreatedAccount & { reactivated: true }) | null> {
  const year = currentAcademicYear();
  const [found] = await getDb()
    .select({
      id: profiles.id,
      role: profiles.role,
      establishmentId: profiles.establishmentId,
      academicYear: profiles.academicYear,
    })
    .from(profiles)
    .where(eq(profiles.email, input.email.toLowerCase()))
    .limit(1);
  if (
    !found ||
    input.role !== "ETUDIANT" ||
    found.role !== "ETUDIANT" ||
    found.establishmentId !== actor.establishmentId ||
    found.academicYear >= year
  ) {
    return null;
  }
  const tempPassword = generateTempPassword();
  const { error } = await supabaseAdmin().auth.admin.updateUserById(found.id, {
    password: tempPassword,
    ban_duration: "none",
  });
  if (error) {
    console.error("[accounts] reactivate", error);
    throw new AppError("INTERNAL", "Réinscription impossible. Réessayez.");
  }
  await getDb().transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({
        fullName: input.fullName,
        academicYear: year,
        isActive: true,
        mustChangePassword: true,
      })
      .where(eq(profiles.id, found.id));
    if (input.groupId) {
      await tx
        .insert(groupMembers)
        .values({ groupId: input.groupId, profileId: found.id })
        .onConflictDoNothing();
    }
    await audit(tx, {
      actorId: actor.id,
      action: "account.reactivate",
      entityType: "profile",
      entityId: found.id,
      payload: { from: found.academicYear, to: year, groupId: input.groupId },
    });
  });
  return { userId: found.id, tempPassword, reactivated: true };
}

/** Le compte ciblé doit appartenir au même établissement que l'administrateur. */
export async function assertAccountInTenant(userId: string, establishmentId: string) {
  const [row] = await getDb()
    .select({ id: profiles.id, email: profiles.email, role: profiles.role })
    .from(profiles)
    .where(and(eq(profiles.id, userId), eq(profiles.establishmentId, establishmentId)))
    .limit(1);
  if (!row) throw errors.notFound("Compte introuvable.");
  return row;
}

/**
 * Crée le compte Supabase Auth (e-mail confirmé, mot de passe provisoire),
 * puis complète le profil. En cas d'échec côté base, le compte Auth est supprimé.
 */
export async function createAccount(actor: TenantUser, input: NewAccount): Promise<CreatedAccount> {
  if (input.groupId) await assertGroupInTenant(input.groupId, actor.establishmentId);

  const tempPassword = generateTempPassword();
  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email: input.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: input.fullName },
  });

  if (error || !data.user) {
    if (error && isEmailTaken(error)) {
      const again = await reactivateStudent(actor, input);
      if (again) return again;
      throw errors.conflict(`Un compte existe déjà avec l'adresse ${input.email}.`);
    }
    console.error("[accounts] createUser", error);
    throw new AppError("INTERNAL", "Création du compte impossible. Réessayez.");
  }

  const userId = data.user.id;
  try {
    await getDb().transaction(async (tx) => {
      // Le trigger SQL crée normalement le profil ; l'upsert couvre le cas où il manque.
      await tx
        .insert(profiles)
        .values({
          id: userId,
          email: input.email,
          fullName: input.fullName,
          role: input.role,
          establishmentId: actor.establishmentId,
          mustChangePassword: true,
        })
        .onConflictDoUpdate({
          target: profiles.id,
          set: {
            fullName: input.fullName,
            role: input.role,
            establishmentId: actor.establishmentId,
            mustChangePassword: true,
          },
        });
      if (input.groupId) {
        await tx
          .insert(groupMembers)
          .values({ groupId: input.groupId, profileId: userId })
          .onConflictDoNothing();
      }
      await audit(tx, {
        actorId: actor.id,
        action: "account.create",
        entityType: "profile",
        entityId: userId,
        payload: { email: input.email, role: input.role, groupId: input.groupId },
      });
    });
  } catch (dbError) {
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    throw dbError;
  }

  return { userId, tempPassword };
}

export async function updateAccountRole(actor: TenantUser, userId: string, role: UserRole) {
  if (userId === actor.id) {
    throw errors.forbidden("Vous ne pouvez pas modifier votre propre rôle.");
  }
  const target = await assertAccountInTenant(userId, actor.establishmentId);
  await getDb().transaction(async (tx) => {
    await tx.update(profiles).set({ role }).where(eq(profiles.id, userId));
    await audit(tx, {
      actorId: actor.id,
      action: "account.role",
      entityType: "profile",
      entityId: userId,
      payload: { from: target.role, to: role },
    });
  });
}

export async function updateAccountName(actor: TenantUser, userId: string, fullName: string) {
  await assertAccountInTenant(userId, actor.establishmentId);
  await getDb().update(profiles).set({ fullName }).where(eq(profiles.id, userId));
}

/** Désactive (bloque aussi la connexion côté Supabase) ou réactive un compte. */
export async function setAccountActive(actor: TenantUser, userId: string, active: boolean) {
  if (userId === actor.id) {
    throw errors.forbidden("Vous ne pouvez pas désactiver votre propre compte.");
  }
  await assertAccountInTenant(userId, actor.establishmentId);
  const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, {
    ban_duration: active ? "none" : BAN_FOREVER,
  });
  if (error) {
    console.error("[accounts] ban", error);
    throw new AppError("INTERNAL", "Modification impossible côté authentification. Réessayez.");
  }
  await getDb().transaction(async (tx) => {
    await tx.update(profiles).set({ isActive: active }).where(eq(profiles.id, userId));
    await audit(tx, {
      actorId: actor.id,
      action: active ? "account.activate" : "account.deactivate",
      entityType: "profile",
      entityId: userId,
    });
  });
}

/** Nouveau mot de passe provisoire, à changer à la prochaine connexion. */
export async function resetAccountPassword(actor: TenantUser, userId: string): Promise<string> {
  await assertAccountInTenant(userId, actor.establishmentId);
  const tempPassword = generateTempPassword();
  const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, {
    password: tempPassword,
  });
  if (error) {
    console.error("[accounts] reset password", error);
    throw new AppError("INTERNAL", "Réinitialisation impossible. Réessayez.");
  }
  await getDb().transaction(async (tx) => {
    await tx.update(profiles).set({ mustChangePassword: true }).where(eq(profiles.id, userId));
    await audit(tx, {
      actorId: actor.id,
      action: "account.reset_password",
      entityType: "profile",
      entityId: userId,
    });
  });
  return tempPassword;
}
