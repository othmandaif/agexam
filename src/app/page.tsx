import { redirect } from "next/navigation";
import { homePathFor } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";

/** Point d'entrée : envoie chaque utilisateur vers son espace. */
export default async function HomePage() {
  const user = await requireUser();
  redirect(homePathFor(user.role));
}
