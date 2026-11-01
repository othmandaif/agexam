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
  /** Correction automatique des algorithmes (relecture du code). Serveur uniquement. */
  DEEPSEEK_API_KEY: z.string().min(1).optional(),
  DEEPSEEK_MODEL: z.string().min(1).default("deepseek-chat"),
  DEEPSEEK_BASE_URL: z.url().default("https://api.deepseek.com"),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

/** Lu à la demande : le build ne plante pas si la base n'est pas configurée. */
export function serverEnv(): ServerEnv {
  cached ??= serverSchema.parse(process.env);
  return cached;
}
