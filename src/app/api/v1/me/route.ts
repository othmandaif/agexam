import { apiRoute, ok } from "@/server/http/api";
import { requireApiUser } from "@/server/auth/session";

/** Exemple de route protégée : renvoie l'utilisateur courant. Modèle pour les futures routes. */
export const GET = apiRoute(async () => {
  const user = await requireApiUser();
  return ok(user);
});
