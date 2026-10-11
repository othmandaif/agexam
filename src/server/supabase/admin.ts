import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/server/env";
import { AppError } from "@/server/http/errors";

let cached: SupabaseClient | undefined;

/**
 * Client Supabase ADMIN (clé secrète) : création de comptes, mots de passe,
 * blocage. Contourne toute sécurité : à n'utiliser que dans du code serveur
 * qui a déjà vérifié le rôle de l'utilisateur (requireTenant("ADMIN")).
 */
export function supabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const secret = serverEnv().SUPABASE_SECRET_KEY;
  if (!secret) {
    throw new AppError(
      "INTERNAL",
      "SUPABASE_SECRET_KEY manquante : la gestion des comptes est désactivée (voir .env.example).",
    );
  }
  cached = createClient(publicEnv().NEXT_PUBLIC_SUPABASE_URL, secret, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  return cached;
}
