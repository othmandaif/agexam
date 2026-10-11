import "server-only";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { cache } from "react";
import { currentAcademicYear } from "@/domain/academic-year";
import type { UserRole } from "@/domain/enums";
import { homePathFor, ROUTES } from "@/lib/routes";
import { getDb } from "@/server/db/client";
import { profiles } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import { createSupabaseServerClient } from "@/server/supabase/server";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  establishmentId: string | null;
  mustChangePassword: boolean;
}

/** Utilisateur rattaché à un établissement : toutes les données sont filtrées par cet établissement. */
export interface TenantUser extends SessionUser {
  establishmentId: string;
}

/**
 * Utilisateur courant, ou null. Le JWT est vérifié par getClaims(),
 * puis le rôle est lu en base (jamais dans le jeton ni les métadonnées).
 * Mis en cache pour la durée de la requête.
 */
async function claimsUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  return error ? null : (data?.claims?.sub ?? null);
}

async function loadProfile(userId: string): Promise<SessionUser | null> {
  const [profile] = await getDb()
    .select({
      id: profiles.id,
      email: profiles.email,
      fullName: profiles.fullName,
      role: profiles.role,
      establishmentId: profiles.establishmentId,
      mustChangePassword: profiles.mustChangePassword,
      isActive: profiles.isActive,
      academicYear: profiles.academicYear,
    })
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (!profile?.isActive) return null;
  // Étudiant non réinscrit cette année scolaire : plus d'accès (données remises à zéro).
  if (profile.role === "ETUDIANT" && profile.academicYear !== currentAcademicYear()) return null;
  const { isActive: _isActive, academicYear: _year, ...user } = profile;
  return user;
}

export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const userId = await claimsUserId();
  return userId ? loadProfile(userId) : null;
});

/**
 * Profils gardés 15 s en mémoire pour les routes API appelées en boucle pendant
 * l'examen (réponse, suivant, présence) : une requête SQL de moins par appel.
 * Le jeton est toujours vérifié à chaque appel ; seul le profil est réutilisé.
 */
const PROFILE_TTL_MS = 15_000;
const profileCache = new Map<string, { user: SessionUser | null; at: number }>();

async function getApiSessionUser(): Promise<SessionUser | null> {
  const userId = await claimsUserId();
  if (!userId) return null;
  const now = Date.now();
  const hit = profileCache.get(userId);
  if (hit && now - hit.at < PROFILE_TTL_MS) return hit.user;
  const user = await loadProfile(userId);
  if (profileCache.size > 5_000) profileCache.clear();
  profileCache.set(userId, { user, at: now });
  return user;
}

/** Pages et Server Actions : redirige vers la connexion si besoin. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(ROUTES.login);
  return user;
}

/**
 * Pages et layouts : renvoie l'utilisateur vers son espace s'il n'a pas le bon rôle,
 * et impose le changement d'un mot de passe provisoire.
 */
export async function requireRole(...roles: UserRole[]): Promise<SessionUser> {
  const user = await requireUser();
  if (user.mustChangePassword) redirect(ROUTES.account.password);
  if (!roles.includes(user.role)) redirect(homePathFor(user.role));
  return user;
}

/** Comme requireRole, et exige le rattachement à un établissement. */
export async function requireTenant(...roles: UserRole[]): Promise<TenantUser> {
  const user = await requireRole(...roles);
  if (!user.establishmentId) {
    redirect(user.role === "ADMIN" ? ROUTES.admin.referential : ROUTES.account.pending);
  }
  return user as TenantUser;
}

/** Routes API : lève une erreur 401 / 403 au lieu de rediriger. */
export async function requireApiUser(...roles: UserRole[]): Promise<SessionUser> {
  const user = await getApiSessionUser();
  if (!user) throw errors.unauthenticated();
  if (user.mustChangePassword) throw errors.forbidden("Changement de mot de passe requis.");
  if (roles.length > 0 && !roles.includes(user.role)) throw errors.forbidden();
  return user;
}

/** Routes API : utilisateur rattaché à un établissement. */
export async function requireApiTenant(...roles: UserRole[]): Promise<TenantUser> {
  const user = await requireApiUser(...roles);
  if (!user.establishmentId) throw errors.forbidden("Compte non rattaché à un établissement.");
  return user as TenantUser;
}
