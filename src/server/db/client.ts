import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { serverEnv } from "@/server/env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { agexamDb?: Database };

/**
 * Sans requête préparée, postgres-js fait deux allers-retours par requête
 * (description puis exécution). Le pooler Supabase en mode transaction (6543)
 * ne les accepte pas ; le mode session (5432) et la connexion directe, si.
 */
function preparedStatementsEnabled(env: ReturnType<typeof serverEnv>): boolean {
  if (env.DATABASE_PREPARE) return env.DATABASE_PREPARE === "true";
  return !/:6543(\/|$)/.test(env.DATABASE_URL);
}

type Sql = ReturnType<typeof postgres>;

/**
 * Drizzle appelle sql.unsafe(), que postgres-js n'exécute jamais en requête
 * préparée : on active la préparation (cache par connexion), y compris dans
 * les transactions (sql.begin → client dédié).
 */
function withPreparedStatements(sql: Sql): Sql {
  const unsafe = sql.unsafe.bind(sql);
  sql.unsafe = ((query: string, args: unknown[] = [], options: object = {}) =>
    unsafe(query, args as never, { prepare: true, ...options })) as Sql["unsafe"];
  // Client de transaction : pas de begin() (seulement savepoint()).
  if (typeof sql.begin !== "function") return sql;
  const begin = sql.begin.bind(sql) as (...a: unknown[]) => Promise<unknown>;
  sql.begin = ((...a: unknown[]) => {
    const fn = a[a.length - 1] as (tx: Sql) => unknown;
    a[a.length - 1] = (tx: Sql) => fn(withPreparedStatements(tx));
    return begin(...a);
  }) as Sql["begin"];
  return sql;
}

function createDatabase(): Database {
  const env = serverEnv();
  const prepare = preparedStatementsEnabled(env);
  const raw = postgres(env.DATABASE_URL, {
    prepare,
    max: 10,
    idle_timeout: 20,
  });
  return drizzle(prepare ? withPreparedStatements(raw) : raw, { schema });
}

/**
 * Client Drizzle partagé (une seule instance par processus, y compris
 * pendant le rechargement à chaud en développement).
 */
export function getDb(): Database {
  globalForDb.agexamDb ??= createDatabase();
  return globalForDb.agexamDb;
}

export { schema };
