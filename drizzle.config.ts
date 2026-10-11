import { config } from "dotenv";

// drizzle-kit ne lit pas .env.local tout seul (contrairement à Next.js)
config({ path: ".env.local" });
config(); // .env en secours, s'il existe
import { defineConfig } from "drizzle-kit";

/** 
 * Les migrations utilisent la connexion DIRECTE (port 5432) ou le pooler en mode session.
 * L'application, elle, utilise le pooler en mode transaction (DATABASE_URL, port 6543).
 */
export default defineConfig({
  schema: "./src/server/db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // Le schéma "auth" appartient à Supabase : drizzle-kit ne le gère pas.
  schemaFilter: ["public"],
  dbCredentials: {
    url: process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
