import { config } from "dotenv";
import postgres from "postgres";

config({ path: ".env.local", quiet: true });

// La base utilisée par l'application (pas DIRECT_DATABASE_URL).
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL manquante dans .env.local");

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

try {
  await sql.unsafe(`
    do $$ begin
      create type public.timer_mode as enum ('PAR_QUESTION', 'GLOBAL');
    exception when duplicate_object then null;
    end $$;

    alter table public.exams
      add column if not exists timer_mode public.timer_mode not null default 'PAR_QUESTION',
      add column if not exists global_duration_sec integer;

    alter table public.attempts
      add column if not exists deadline_at timestamptz;

    create index if not exists exams_author_idx on public.exams (author_id);
    create index if not exists attempts_student_idx on public.attempts (student_id, started_at);
  `);

  const cols = await sql`
    select table_name, column_name from information_schema.columns
    where table_schema = 'public'
      and column_name in ('timer_mode', 'global_duration_sec', 'deadline_at')
    order by table_name, column_name`;
  console.log("✓ Base corrigée :", cols.map((c) => `${c.table_name}.${c.column_name}`).join(", "));
} catch (error) {
  console.error("✗ Échec :", error);
  process.exitCode = 1;
} finally {
  await sql.end();
}