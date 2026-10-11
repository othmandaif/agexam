import "server-only";
import { sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { currentAcademicYear, isAcademicYear } from "@/domain/academic-year";
import { getDb } from "@/server/db/client";
import { errors } from "@/server/http/errors";

export const YEAR_COOKIE = "agexam_annee";

/**
 * Année affichée (sélecteur du personnel) : cookie validé, sinon l'année
 * courante. Une année future n'est jamais acceptée.
 */
export const getViewYear = cache(async (): Promise<string> => {
  const current = currentAcademicYear();
  const value = (await cookies()).get(YEAR_COOKIE)?.value;
  return isAcademicYear(value) && value <= current ? value : current;
});

/** Vrai si l'année affichée est passée (consultation seule). */
export async function isPastYearView(): Promise<boolean> {
  return (await getViewYear()) !== currentAcademicYear();
}

/** Années proposées dans le sélecteur : celles qui ont des données + l'année courante. */
export async function listAcademicYears(establishmentId: string): Promise<string[]> {
  const rows = (await getDb().execute(sql`
    select academic_year from exams where establishment_id = ${establishmentId}
    union select academic_year from groups where establishment_id = ${establishmentId}
  `)) as unknown as { academic_year: string }[];
  const current = currentAcademicYear();
  return [...new Set([current, ...rows.map((r) => r.academic_year)])]
    .filter((y) => isAcademicYear(y) && y <= current)
    .sort()
    .reverse();
}

/** Garde des mutations : les données d'une année passée sont en lecture seule. */
export function assertCurrentYear(year: string | null | undefined, what = "Cet élément") {
  if (year && year !== currentAcademicYear()) {
    throw errors.conflict(`${what} appartient à l'année ${year} : consultation seule.`);
  }
}
