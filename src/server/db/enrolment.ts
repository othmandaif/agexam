import "server-only";
import { sql, type SQL } from "drizzle-orm";

/**
 * Inscrits d'un examen = membres de ses groupes ∪ étudiants ajoutés
 * individuellement (exam_candidates, ex. rattrapage). Règle unique, utilisée
 * pour l'accès, les listes étudiant, le suivi, les résultats et les stats.
 */
export function isEnrolledSql(examId: SQL | string, profileId: SQL | string): SQL {
  return sql`(exists (
      select 1 from exam_groups eg_e
      join group_members gm_e on gm_e.group_id = eg_e.group_id
      where eg_e.exam_id = ${examId} and gm_e.profile_id = ${profileId}
    ) or exists (
      select 1 from exam_candidates ec_e
      where ec_e.exam_id = ${examId} and ec_e.profile_id = ${profileId}
    ))`;
}

/** Sous-requête des identifiants des inscrits (colonne profile_id). */
export function enrolledIdsSql(examId: SQL | string): SQL {
  return sql`(
    select gm_i.profile_id from group_members gm_i
    join exam_groups eg_i on eg_i.group_id = gm_i.group_id
    where eg_i.exam_id = ${examId}
    union
    select ec_i.profile_id from exam_candidates ec_i where ec_i.exam_id = ${examId}
  )`;
}
