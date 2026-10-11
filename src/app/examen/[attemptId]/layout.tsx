import { requireTenant } from "@/server/auth/session";

/** Mode examen : plein écran, sans navigation. La propriété de la tentative est vérifiée dans la page. */
export default async function ExamModeLayout({ children }: { children: React.ReactNode }) {
  await requireTenant("ETUDIANT");
  return children;
}
