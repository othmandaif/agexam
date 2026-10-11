import { config } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });

const url = process.env.DIRECT_DATABASE_URL;
if (!url) throw new Error("DIRECT_DATABASE_URL manquante dans .env.local");

const sql = postgres(url, { max: 1, connect_timeout: 15 });

try {
  await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
  console.log("✓ Migrations appliquées");
} catch (error) {
  console.error("✗ Échec de la migration :", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}