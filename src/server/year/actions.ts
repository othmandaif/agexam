"use server";

import { cookies } from "next/headers";
import { currentAcademicYear, isAcademicYear } from "@/domain/academic-year";
import { requireTenant } from "@/server/auth/session";
import { YEAR_COOKIE } from "./index";

/** Change l'année affichée (personnel uniquement). */
export async function setViewYearAction(year: string): Promise<void> {
  await requireTenant("FORMATEUR", "ADMIN");
  const jar = await cookies();
  const current = currentAcademicYear();
  if (!isAcademicYear(year) || year >= current) {
    jar.delete(YEAR_COOKIE);
    return;
  }
  jar.set(YEAR_COOKIE, year, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 * 30 });
}
