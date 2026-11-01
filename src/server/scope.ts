import { eq, isNull, or, sql, type SQL } from "drizzle-orm";
import { groups } from "@/server/db/schema";

/**
 * Périmètre d'un formateur : ses groupes (et les groupes historiques sans propriétaire).
 * L'administrateur ne gère que les comptes des formateurs : aucun filtre pour lui.
 */
export function viewerOf(user: { id: string; role: string }): string | null {
  return user.role === "FORMATEUR" ? user.id : null;
}

/** Condition sur la table `groups` (Drizzle). */
export function groupScope(viewerId: string | null | undefined): SQL | undefined {
  return viewerId ? or(eq(groups.ownerId, viewerId), isNull(groups.ownerId)) : undefined;
}

/**
 * Condition SQL brute sur un profil étudiant d'alias `alias` : créé par le formateur,
 * compte historique sans créateur, ou membre d'un de ses groupes.
 */
export function studentScope(viewerId: string | null | undefined, alias = "p"): SQL | undefined {
  if (!viewerId) return undefined;
  const a = sql.raw(alias);
  return sql`(${a}.created_by = ${viewerId} or ${a}.created_by is null
    or exists (select 1 from group_members gms join groups gs on gs.id = gms.group_id
      where gms.profile_id = ${a}.id and gs.owner_id = ${viewerId}))`;
}
