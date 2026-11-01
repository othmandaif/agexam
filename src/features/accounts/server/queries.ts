import "server-only";
import { and, asc, count, eq, ilike, or, sql } from "drizzle-orm";
import { currentAcademicYear } from "@/domain/academic-year";
import type { UserRole } from "@/domain/enums";
import { getDb } from "@/server/db/client";
import { groupMembers, groups, profiles } from "@/server/db/schema";
import { groupScope, studentScope } from "@/server/scope";

/**
 * Noms des groupes d'un profil, séparés par des virgules.
 * Colonnes qualifiées explicitement : dans une sous-requête corrélée, un « id » nu
 * serait résolu sur la table de la sous-requête.
 */
const groupNamesSql = (viewerId: string | null | undefined) => sql<string | null>`(
  select string_agg(g.name, ', ' order by g.name)
  from ${groupMembers} gm
  join ${groups} g on g.id = gm.group_id
  where gm.profile_id = ${sql.identifier("profiles")}.${sql.identifier("id")}
    ${viewerId ? sql`and (g.owner_id = ${viewerId} or g.owner_id is null)` : sql``}
)`;

/** Comptes paginés en base (filtres rôle / recherche dans la requête). */
export async function listAccounts(
  establishmentId: string,
  filters: {
    role?: UserRole;
    q?: string;
    groupId?: string | null;
    year?: string;
    /** Formateur : ne voit que ses étudiants et ses groupes. */
    viewerId?: string | null;
    /** Administration : comptes du personnel seulement (pas les étudiants). */
    staffOnly?: boolean;
  } = {},
  page: { offset: number; limit: number } = { offset: 0, limit: 20 },
) {
  const term = filters.q?.trim().replace(/[%_\\]/g, (c) => `\\${c}`);
  const where = and(
    eq(profiles.establishmentId, establishmentId),
    filters.role ? eq(profiles.role, filters.role) : undefined,
    filters.staffOnly ? sql`${profiles.role} <> 'ETUDIANT'` : undefined,
    term
      ? or(ilike(profiles.fullName, `%${term}%`), ilike(profiles.email, `%${term}%`))
      : undefined,
    // Étudiants de l'année : compte actif cette année ou membre d'un groupe de l'année.
    filters.year
      ? sql`(${profiles.role} <> 'ETUDIANT' or ${profiles.academicYear} = ${filters.year}
          or exists (select 1 from ${groupMembers} gmy join ${groups} gy on gy.id = gmy.group_id
            where gy.academic_year = ${filters.year}
              and gmy.profile_id = ${sql.identifier("profiles")}.${sql.identifier("id")}))`
      : undefined,
    filters.viewerId
      ? sql`(${profiles.role} <> 'ETUDIANT' or ${studentScope(filters.viewerId, "profiles")})`
      : undefined,
    filters.groupId
      ? sql`exists (select 1 from ${groupMembers} gmf where gmf.group_id = ${filters.groupId}
          and gmf.profile_id = ${sql.identifier("profiles")}.${sql.identifier("id")})`
      : undefined,
  );
  const db = getDb();
  const [rows, totals] = await Promise.all([
    db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        email: profiles.email,
        role: profiles.role,
        isActive: profiles.isActive,
        mustChangePassword: profiles.mustChangePassword,
        groupNames: groupNamesSql(filters.viewerId),
      })
      .from(profiles)
      .where(where)
      .orderBy(asc(profiles.role), asc(profiles.fullName), asc(profiles.id))
      .limit(page.limit)
      .offset(page.offset),
    db.select({ total: count() }).from(profiles).where(where),
  ]);
  return { rows, total: totals[0]?.total ?? 0 };
}

export async function countAccountsByRole(
  establishmentId: string,
  year: string = currentAcademicYear(),
) {
  const rows = await getDb()
    .select({ role: profiles.role, total: count() })
    .from(profiles)
    .where(
      and(
        eq(profiles.establishmentId, establishmentId),
        eq(profiles.isActive, true),
        sql`(${profiles.role} <> 'ETUDIANT' or ${profiles.academicYear} = ${year})`,
      ),
    )
    .groupBy(profiles.role);
  const result: Record<UserRole, number> = { ADMIN: 0, FORMATEUR: 0, ETUDIANT: 0 };
  for (const r of rows) result[r.role] = r.total;
  return result;
}

/** Compte + groupes, uniquement s'il appartient à l'établissement. */
export async function getAccount(establishmentId: string, userId: string) {
  const db = getDb();
  const [account] = await db
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      email: profiles.email,
      role: profiles.role,
      isActive: profiles.isActive,
      mustChangePassword: profiles.mustChangePassword,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .where(and(eq(profiles.id, userId), eq(profiles.establishmentId, establishmentId)))
    .limit(1);
  if (!account) return null;

  const memberOf = await db
    .select({ id: groups.id, name: groups.name })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.profileId, userId))
    .orderBy(asc(groups.name));

  return { ...account, groups: memberOf };
}

export async function listGroupOptions(
  establishmentId: string,
  year: string = currentAcademicYear(),
  viewerId: string | null = null,
) {
  return getDb()
    .select({ id: groups.id, name: groups.name })
    .from(groups)
    .where(
      and(
        eq(groups.establishmentId, establishmentId),
        eq(groups.academicYear, year),
        groupScope(viewerId),
      ),
    )
    .orderBy(asc(groups.name));
}
