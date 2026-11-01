import "server-only";
import { and, asc, eq, ilike, notExists, or } from "drizzle-orm";
import { currentAcademicYear } from "@/domain/academic-year";
import { getDb } from "@/server/db/client";
import { examGroups, groupMembers, groups, profiles } from "@/server/db/schema";
import { groupScope, studentScope } from "@/server/scope";

export async function listGroups(
  establishmentId: string,
  year: string = currentAcademicYear(),
  viewerId: string | null = null,
) {
  const db = getDb();
  return db
    .select({
      id: groups.id,
      name: groups.name,
      label: groups.label,
      memberCount: db.$count(groupMembers, eq(groupMembers.groupId, groups.id)),
      examCount: db.$count(examGroups, eq(examGroups.groupId, groups.id)),
    })
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

/** Groupe, uniquement s'il appartient à l'établissement. */
export async function getGroup(
  establishmentId: string,
  groupId: string,
  viewerId: string | null = null,
) {
  const db = getDb();
  const [row] = await db
    .select({
      id: groups.id,
      name: groups.name,
      label: groups.label,
      academicYear: groups.academicYear,
      examCount: db.$count(examGroups, eq(examGroups.groupId, groups.id)),
    })
    .from(groups)
    .where(
      and(
        eq(groups.id, groupId),
        eq(groups.establishmentId, establishmentId),
        groupScope(viewerId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function listGroupMembers(groupId: string) {
  return getDb()
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      email: profiles.email,
      isActive: profiles.isActive,
      mustChangePassword: profiles.mustChangePassword,
    })
    .from(groupMembers)
    .innerJoin(profiles, eq(profiles.id, groupMembers.profileId))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(asc(profiles.fullName));
}

/** Étudiants actifs de l'établissement qui ne sont pas encore dans le groupe. */
export async function listAvailableStudents(
  establishmentId: string,
  groupId: string,
  search?: string,
  viewerId: string | null = null,
) {
  const db = getDb();
  const term = search?.trim();
  return db
    .select({ id: profiles.id, fullName: profiles.fullName, email: profiles.email })
    .from(profiles)
    .where(
      and(
        eq(profiles.establishmentId, establishmentId),
        eq(profiles.role, "ETUDIANT"),
        eq(profiles.isActive, true),
        eq(profiles.academicYear, currentAcademicYear()),
        studentScope(viewerId, "profiles"),
        notExists(
          db
            .select({ one: groupMembers.profileId })
            .from(groupMembers)
            .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.profileId, profiles.id))),
        ),
        term
          ? or(ilike(profiles.fullName, `%${term}%`), ilike(profiles.email, `%${term}%`))
          : undefined,
      ),
    )
    .orderBy(asc(profiles.fullName))
    .limit(50);
}
