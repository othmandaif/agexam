import { parseBankFilters } from "@/features/bank/schemas";
import { listBankQuestions } from "@/features/bank/server/queries";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute, ok } from "@/server/http/api";

/** Recherche dans la banque (sélecteur « Ajouter depuis la banque » de l'éditeur). */
export const GET = apiRoute(async (req) => {
  const user = await requireApiTenant("FORMATEUR", "ADMIN");
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const filters = parseBankFilters({ ...params, archives: undefined });
  return ok(await listBankQuestions(user, filters, 40));
});
