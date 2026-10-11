import { buildImportTemplate } from "@/features/accounts/import/server";
import { listGroupOptions } from "@/features/accounts/server/queries";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute } from "@/server/http/api";

/** Modèle Excel à remplir pour importer des étudiants (groupes existants proposés). */
export const GET = apiRoute(async () => {
  const actor = await requireApiTenant("ADMIN", "FORMATEUR");
  const groups = await listGroupOptions(actor.establishmentId);
  const buffer = await buildImportTemplate(
    groups.map((g) => g.name),
    { withGroupColumn: actor.role === "ADMIN" },
  );
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="modele-import-etudiants.xlsx"',
      "Cache-Control": "no-store",
    },
  });
});
