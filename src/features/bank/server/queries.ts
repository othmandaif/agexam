import "server-only";
import { sql, type SQL } from "drizzle-orm";
import type { CodeLanguage, Difficulty, QuestionType } from "@/domain/enums";
import type { QuestionOption } from "@/domain/exam-settings";
import type { AlgoQuestionData } from "@/server/db/schema";
import { observedDifficulty } from "@/domain/statistics";
import type { TenantUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import type {
  BankFilters,
  BankListResult,
  BankQuestion,
  BankQuestionDetail,
  BankUsage,
  BankVersion,
} from "../types";

export const BANK_PAGE_SIZE = 100;

interface Row {
  id: string;
  type: QuestionType;
  difficulty: Difficulty;
  module_id: string;
  module_code: string;
  chapter_id: string | null;
  chapter_name: string | null;
  author_id: string | null;
  author_name: string | null;
  version: number;
  prompt: string;
  code: string | null;
  code_language: CodeLanguage | null;
  options: QuestionOption[];
  explanation: string | null;
  algo: AlgoQuestionData | null;
  suggested_duration_sec: number;
  default_points: string;
  archived_at: string | null;
  created_at: string;
  exam_count: number;
  draft_count: number;
  last_used_at: string | null;
  responses: number;
  correct: number;
}

const iso = (v: string | Date | null) => (v ? new Date(v).toISOString() : null);

/** Échappe % et _ pour une recherche ILIKE littérale. */
const likePattern = (q: string) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

const SELECT = sql`
  select
    q.id, q.type, q.difficulty, q.module_id, m.code as module_code,
    q.chapter_id, c.name as chapter_name, q.author_id, p.full_name as author_name,
    cv.version, cv.prompt, cv.code, cv.code_language, cv.options, cv.explanation, cv.algo,
    q.suggested_duration_sec, cv.default_points, q.archived_at, q.created_at,
    coalesce(u.exam_count, 0)::int as exam_count,
    coalesce(u.draft_count, 0)::int as draft_count,
    u.last_used_at,
    coalesce(s.responses, 0)::int as responses,
    coalesce(s.correct, 0)::int as correct
  from questions q
  join question_versions cv on cv.question_id = q.id and cv.version = q.current_version
  join modules m on m.id = q.module_id
  left join chapters c on c.id = q.chapter_id
  left join profiles p on p.id = q.author_id
  left join lateral (
    select
      count(distinct eq.exam_id) filter (where e.status <> 'BROUILLON') as exam_count,
      count(distinct eq.exam_id) filter (where e.status = 'BROUILLON') as draft_count,
      max(coalesce(e.opens_at, e.created_at)) filter (where e.status <> 'BROUILLON') as last_used_at
    from exam_questions eq
    join question_versions v on v.id = eq.question_version_id
    join exams e on e.id = eq.exam_id
    where v.question_id = q.id
  ) u on true
  left join lateral (
    select count(*) as responses, count(*) filter (where aq.is_correct) as correct
    from attempt_questions aq
    join exam_questions eq on eq.id = aq.exam_question_id
    join question_versions v on v.id = eq.question_version_id
    join attempts a on a.id = aq.attempt_id
    where v.question_id = q.id
      and a.status in ('SOUMISE', 'SOUMISE_AUTO', 'EXPIREE')
      and aq.status in ('REPONDUE', 'EXPIREE')
      and eq.neutralized_at is null
  ) s on true
`;

function toQuestion(r: Row): BankQuestion {
  const successRate = r.responses > 0 ? r.correct / r.responses : null;
  return {
    id: r.id,
    type: r.type,
    difficulty: r.difficulty,
    moduleId: r.module_id,
    moduleCode: r.module_code,
    chapterId: r.chapter_id,
    chapterName: r.chapter_name,
    authorId: r.author_id,
    authorName: r.author_name,
    version: r.version,
    prompt: r.prompt,
    code: r.code,
    codeLanguage: r.code_language,
    options: r.options.map((o) => ({
      label: o.label,
      isCorrect: o.isCorrect,
      fixedPosition: !!o.fixedPosition,
    })),
    explanation: r.explanation,
    algo: r.algo ? { kind: r.algo.kind, solution: r.algo.solution, tests: r.algo.tests } : null,
    suggestedDurationSec: r.suggested_duration_sec,
    defaultPoints: Number(r.default_points),
    archived: r.archived_at !== null,
    createdAt: new Date(r.created_at).toISOString(),
    stats: {
      examCount: r.exam_count,
      draftCount: r.draft_count,
      responses: r.responses,
      correct: r.correct,
      successRate,
      observed: observedDifficulty(successRate, r.responses),
      lastUsedAt: iso(r.last_used_at),
    },
  };
}

function conditions(user: TenantUser, f: BankFilters): SQL {
  const parts: SQL[] = [
    sql`q.establishment_id = ${user.establishmentId}`,
    f.archived ? sql`q.archived_at is not null` : sql`q.archived_at is null`,
  ];
  if (f.moduleId) parts.push(sql`q.module_id = ${f.moduleId}`);
  if (f.chapterId) parts.push(sql`q.chapter_id = ${f.chapterId}`);
  if (f.type) parts.push(sql`q.type = ${f.type}`);
  if (f.difficulty) parts.push(sql`q.difficulty = ${f.difficulty}`);
  const q = f.q.trim();
  if (q) {
    const pattern = likePattern(q);
    parts.push(
      sql`(cv.prompt ilike ${pattern} or cv.code ilike ${pattern}
        or exists (select 1 from jsonb_array_elements(cv.options) o where o->>'label' ilike ${pattern}))`,
    );
  }
  return sql.join(parts, sql` and `);
}

const ORDER: Record<BankFilters["sort"], SQL> = {
  recent: sql`q.created_at desc`,
  used: sql`coalesce(u.exam_count, 0) desc, coalesce(s.responses, 0) desc, q.created_at desc`,
  hardest: sql`(s.correct::float / nullif(s.responses, 0)) asc nulls last, q.created_at desc`,
  easiest: sql`(s.correct::float / nullif(s.responses, 0)) desc nulls last, q.created_at desc`,
};

/** Questions de l'établissement (banque partagée entre formateurs), avec leurs statistiques. */
export async function listBankQuestions(
  user: TenantUser,
  filters: BankFilters,
  limit = BANK_PAGE_SIZE,
): Promise<BankListResult> {
  const db = getDb();
  const where = conditions(user, filters);
  const [rows, [count]] = await Promise.all([
    db.execute(
      sql`${SELECT} where ${where} order by ${ORDER[filters.sort]} limit ${limit}`,
    ) as Promise<unknown[]>,
    db.execute(sql`
      select count(*)::int as total
      from questions q
      join question_versions cv on cv.question_id = q.id and cv.version = q.current_version
      where ${where}
    `) as Promise<{ total: number }[]>,
  ]);
  const items = (rows as Row[]).map(toQuestion);
  const total = count?.total ?? 0;
  return { items, total, truncated: total > items.length };
}

/** Détail d'une question : versions et utilisation dans chaque examen. */
export async function getBankQuestion(
  user: TenantUser,
  questionId: string,
): Promise<BankQuestionDetail | null> {
  const db = getDb();
  const [row] = (await db.execute(
    sql`${SELECT} where q.id = ${questionId} and q.establishment_id = ${user.establishmentId}`,
  )) as unknown as Row[];
  if (!row) return null;
  const question = toQuestion(row);

  const versionRows = (await db.execute(sql`
    select version, created_at, options from question_versions
    where question_id = ${questionId} order by version desc
  `)) as unknown as { version: number; created_at: string; options: QuestionOption[] }[];
  const versions: BankVersion[] = versionRows.map((v) => ({
    version: v.version,
    createdAt: new Date(v.created_at).toISOString(),
    correctLabels: v.options.filter((o) => o.isCorrect).map((o) => o.label),
    current: v.version === question.version,
  }));

  const usageRows = (await db.execute(sql`
    select
      e.id as exam_id, e.title, e.status, e.opens_at, p.full_name as author_name,
      v.version, eq.neutralized_at,
      (select count(*)::int from attempt_questions aq join attempts a on a.id = aq.attempt_id
        where aq.exam_question_id = eq.id and a.status in ('SOUMISE', 'SOUMISE_AUTO', 'EXPIREE')
          and aq.status in ('REPONDUE', 'EXPIREE')) as responses,
      (select count(*)::int from attempt_questions aq join attempts a on a.id = aq.attempt_id
        where aq.exam_question_id = eq.id and a.status in ('SOUMISE', 'SOUMISE_AUTO', 'EXPIREE')
          and aq.status in ('REPONDUE', 'EXPIREE') and aq.is_correct) as correct
    from exam_questions eq
    join question_versions v on v.id = eq.question_version_id
    join exams e on e.id = eq.exam_id
    left join profiles p on p.id = e.author_id
    where v.question_id = ${questionId} and e.establishment_id = ${user.establishmentId}
    order by coalesce(e.opens_at, e.created_at) desc
  `)) as unknown as {
    exam_id: string;
    title: string;
    status: string;
    opens_at: string | null;
    author_name: string | null;
    version: number;
    neutralized_at: string | null;
    responses: number;
    correct: number;
  }[];
  const usages: BankUsage[] = usageRows.map((u) => ({
    examId: u.exam_id,
    title: u.title,
    status: u.status,
    opensAt: iso(u.opens_at),
    authorName: u.author_name,
    version: u.version,
    neutralized: u.neutralized_at !== null,
    responses: u.responses,
    correct: u.correct,
    successRate: u.responses > 0 && !u.neutralized_at ? u.correct / u.responses : null,
  }));

  return {
    ...question,
    canEdit: user.role === "ADMIN" || question.authorId === user.id,
    versions,
    usages,
  };
}

/** Questions choisies, dans l'ordre demandé (pour préremplir un nouvel examen). */
export async function getBankQuestionsByIds(
  user: TenantUser,
  ids: string[],
): Promise<BankQuestion[]> {
  if (ids.length === 0) return [];
  const rows = (await getDb().execute(
    sql`${SELECT} where q.establishment_id = ${user.establishmentId}
      and q.id in (${sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})`,
  )) as unknown as Row[];
  const byId = new Map(rows.map((r) => [r.id, toQuestion(r)]));
  return ids.map((id) => byId.get(id)).filter((q): q is BankQuestion => !!q);
}

/** Nombre de questions actives de la banque de l'établissement. */
export async function countBankQuestions(user: TenantUser): Promise<number> {
  const [row] = (await getDb().execute(sql`
    select count(*)::int as n from questions
    where establishment_id = ${user.establishmentId} and archived_at is null
  `)) as unknown as { n: number }[];
  return row?.n ?? 0;
}
