import { z } from "zod";
import { buildStudentsExport } from "@/features/accounts/import/server";
import { listAccounts, listGroupOptions } from "@/features/accounts/server/queries";
import { requireApiTenant } from "@/server/auth/session";
import { getViewYear } from "@/server/year";
import { apiRoute } from "@/server/http/api";

const EXPORT_LIMIT = 5000;

/** Liste des étudiants en Excel, avec les filtres de la page (?q=&groupe=). */
export const GET = apiRoute(async (req) => {
  const actor = await requireApiTenant("ADMIN", "FORMATEUR");
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 100) || undefined;
  const groupParam = url.searchParams.get("groupe");
  const groupId = groupParam && z.uuid().safeParse(groupParam).success ? groupParam : null;
  const year = await getViewYear();
  const [{ rows }, groups] = await Promise.all([
    listAccounts(
      actor.establishmentId,
      { role: "ETUDIANT", q, groupId, year },
      { offset: 0, limit: EXPORT_LIMIT },
    ),
    listGroupOptions(actor.establishmentId, year),
  ]);
  const groupName = groupId ? groups.find((g) => g.id === groupId)?.name : null;
  const buffer = await buildStudentsExport(
    rows,
    `Étudiants ${year}${groupName ? ` · ${groupName}` : ""}`,
  );
  const suffix = `-${year}${groupName ? `-${groupName.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase()}` : ""}`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="etudiants${suffix}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
});
