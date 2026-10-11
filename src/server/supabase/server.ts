import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicEnv } from "@/lib/env";

/**
 * Client Supabase côté serveur, utilisé UNIQUEMENT pour l'authentification
 * (connexion, déconnexion, lecture de la session). Les données passent par Drizzle.
 * Créer un nouveau client à chaque requête.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const env = publicEnv();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Appelé depuis un Server Component : écriture impossible.
            // Sans gravité, le proxy rafraîchit la session à chaque requête.
          }
        },
      },
    },
  );
}
