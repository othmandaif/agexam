import "server-only";
import { z } from "zod";

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL manquante (voir .env.example)"),
  /**
   * Requêtes préparées (un aller-retour par requête au lieu de deux).
   * Par défaut : actives, sauf sur le pooler Supabase en mode transaction (port 6543).
   */
  DATABASE_PREPARE: z.enum(["true", "false"]).optional(),
  /** Clé secrète Supabase (sb_secret_… ou service_role). Serveur uniquement. */
  SUPABASE_SECRET_KEY: z.string().min(1).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

/** Lu à la demande : le build ne plante pas si la base n'est pas configurée. */
export function serverEnv(): ServerEnv {
  cached ??= serverSchema.parse(process.env);
  return cached;
}
