import "server-only";
import { studentScope, viewerOf } from "@/server/scope";
import { sql, type SQL } from "drizzle-orm";
import {
  groupCopies,
  participationRate,
  periodStart,
  studentProgress,
  summarizeCopies,
  type GradedCopy,
} from "@/domain/analytics";
import { histogram, PASS_MARK, summarizeScores } from "@/domain/statistics";
import type { TenantUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import type {
  AnalyticsData,
  AnalyticsFilters,
  ExamPoint,
  HardQuestion,
  SegmentRow,
  StudentReport,
  StudentRow,
  StudentReportExam,
} from "../types";

const FINISHED = sql`('SOUMISE', 'SOUMISE_AUTO', 'EXPIREE')`;
const HARD_MIN_RESPONSES = 10;

/** Examens analysés : publiés, déjà ouverts, hors entraînement, dans le périmètre de l'utilisateur. */
function examScope(user: TenantUser, f: AnalyticsFilters, now: Date): SQL {
  // Année choisie : « toute l'année » = pas de borne de date en plus.
  const since =
    f.year && (f.period === "annee" || f.period === "tout") ? null : periodStart(f.period, now);
  const parts: SQL[] = [
    sql`e.establishment_id = ${user.establishmentId}`,
    ...(f.year ? [sql`e.academic_year = ${f.year}`] : []),
    sql`e.status not in ('BROUILLON', 'ARCHIVE')`,
    sql`not e.is_practice`,
    sql`coalesce(e.opens_at, e.created_at) <= ${now.toISOString()}::timestamptz`,
  ];
  if (user.role !== "ADMIN") parts.push(sql`e.author_id = ${user.id}`);
  if (f.moduleId) parts.push(sql`e.module_id = ${f.moduleId}`);
  if (f.examId) parts.push(sql`e.id = ${f.examId}`);
  if (since)
    parts.push(sql`coalesce(e.opens_at, e.created_at) >= ${since.toISOString()}::timestamptz`);
  if (f.groupId) {
    parts.push(
      sql`exists (select 1 from exam_groups eg0 where eg0.exam_id = e.id and eg0.group_id = ${f.groupId})`,
    );
  }
  return sql.join(parts, sql` and `);
}

/** Inscrits d'un examen : membres de ses groupes (limités au groupe filtré). */
function enrolledJoin(f: AnalyticsFilters): SQL {
  return f.groupId
    ? sql`join exam_groups eg on eg.exam_id = e.id and eg.group_id = ${f.groupId}
          join group_members gm on gm.group_id = eg.group_id`
    : sql`join exam_groups eg on eg.exam_id = e.id
          join group_members gm on gm.group_id = eg.group_id`;
}

interface CopyRow {
  attempt_id: string;
  exam_id: string;
  exam_at: string;
  module_id: string | null;
  student_id: string;
  full_name: string;
  score: string;
  flagged: boolean;
  group_ids: string[] | null;
}

interface EnrolledRow {
  exam_id: string;
  group_id: string | null;
  student_id: string;
  full_name: string;
}

export async function getAnalytics(
  user: TenantUser,
  filters: AnalyticsFilters,
): Promise<AnalyticsData> {
  const db = getDb();
  const now = new Date();
  const scope = examScope(user, filters, now);

  // Liste des examens du filtre « Examen » : même périmètre, sans le filtre examen lui-même.
  const optionScope = examScope(user, { ...filters, examId: null }, now);
  const [examRows, enrolledRows, copyRows, moduleRows, groupRows, examOptionRows] =
    await Promise.all([
      db.execute(sql`
      select e.id, e.title, coalesce(e.opens_at, e.created_at) as exam_at, e.module_id,
        m.code as module_code,
        (e.status = 'FERME' or (e.closes_at is not null and e.closes_at <= ${now.toISOString()}::timestamptz)) as finished
      from exams e left join modules m on m.id = e.module_id
      where ${scope}
      order by exam_at
    `) as Promise<unknown[]>,
      db.execute(sql`
      select distinct e.id as exam_id, eg.group_id, gm.profile_id as student_id, p.full_name
      from exams e ${enrolledJoin(filters)}
      join profiles p on p.id = gm.profile_id and p.role = 'ETUDIANT'
      where ${scope}
      ${
        // Étudiants ajoutés individuellement (sans groupe d'examen) : hors filtre groupe.
        filters.groupId
          ? sql``
          : sql`union
      select distinct e.id, null::uuid, ec.profile_id, p.full_name
      from exams e
      join exam_candidates ec on ec.exam_id = e.id
      join profiles p on p.id = ec.profile_id and p.role = 'ETUDIANT'
      where ${scope}`
      }
    `) as Promise<unknown[]>,
      db.execute(sql`
      select a.id as attempt_id, a.exam_id, coalesce(e.opens_at, e.created_at) as exam_at,
        e.module_id, a.student_id, p.full_name, a.score_out_of_20 as score,
        a.flagged_for_review as flagged,
        (select array_agg(distinct gm.group_id)
           from group_members gm
           join exam_groups eg on eg.group_id = gm.group_id and eg.exam_id = e.id
          where gm.profile_id = a.student_id
            ${filters.groupId ? sql`and gm.group_id = ${filters.groupId}` : sql``}) as group_ids
      from attempts a
      join exams e on e.id = a.exam_id
      join profiles p on p.id = a.student_id
      where ${scope}
        and a.status in ${FINISHED}
        and a.score_out_of_20 is not null
        and a.id = (
          select x.id from attempts x
          where x.exam_id = a.exam_id and x.student_id = a.student_id and x.status <> 'ANNULEE'
          order by x.started_at desc limit 1
        )
        ${
          filters.groupId
            ? sql`and exists (select 1 from group_members g1 where g1.group_id = ${filters.groupId} and g1.profile_id = a.student_id)`
            : sql``
        }
    `) as Promise<unknown[]>,
      db.execute(sql`
      select id, code, name from modules where establishment_id = ${user.establishmentId} order by code
    `) as Promise<unknown[]>,
      db.execute(sql`
      select id, name from groups where establishment_id = ${user.establishmentId}
      ${filters.year ? sql`and academic_year = ${filters.year}` : sql``} order by name
    `) as Promise<unknown[]>,
      db.execute(sql`
      select e.id, e.title, m.code as module_code
      from exams e left join modules m on m.id = e.module_id
      where ${optionScope}
      order by coalesce(e.opens_at, e.created_at) desc
      limit 200
    `) as Promise<unknown[]>,
    ]);

  const exams = examRows as {
    id: string;
    title: string;
    exam_at: string;
    module_id: string | null;
    module_code: string | null;
    finished: boolean;
  }[];
  const examOptions = (
    examOptionRows as { id: string; title: string; module_code: string | null }[]
  ).map((e) => ({ id: e.id, title: e.title, moduleCode: e.module_code }));
  const enrolled = enrolledRows as EnrolledRow[];
  const rows = copyRows as CopyRow[];
  const modules = moduleRows as { id: string; code: string; name: string }[];
  const groups = groupRows as { id: string; name: string }[];

  const copies: GradedCopy[] = rows.map((r) => ({
    examId: r.exam_id,
    examAt: new Date(r.exam_at).getTime(),
    moduleId: r.module_id,
    studentId: r.student_id,
    groupIds: r.group_ids ?? [],
    score: Number(r.score),
  }));

  // Inscrits par examen et par (examen, groupe)
  const enrolledByExam = new Map<string, Set<string>>();
  const enrolledByGroup = new Map<string, Set<string>>(); // clé groupe → "examen:étudiant"
  for (const e of enrolled) {
    (enrolledByExam.get(e.exam_id) ?? enrolledByExam.set(e.exam_id, new Set()).get(e.exam_id)!).add(
      e.student_id,
    );
    if (e.group_id) {
      (
        enrolledByGroup.get(e.group_id) ??
        enrolledByGroup.set(e.group_id, new Set()).get(e.group_id)!
      ).add(`${e.exam_id}:${e.student_id}`);
    }
  }

  // ── Examens ───────────────────────────────────────────────────────────────
  const copiesByExam = groupCopies(copies, (c) => [c.examId]);
  const examPoints: ExamPoint[] = exams.map((e) => {
    const list = copiesByExam.get(e.id) ?? [];
    const s = summarizeCopies(list);
    return {
      examId: e.id,
      title: e.title,
      examAt: new Date(e.exam_at).toISOString(),
      moduleCode: e.module_code,
      enrolled: enrolledByExam.get(e.id)?.size ?? 0,
      submitted: list.length,
      mean: s.mean,
      passRate: s.passRate,
    };
  });

  // ── Par groupe ────────────────────────────────────────────────────────────
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const byGroup: SegmentRow[] = [...enrolledByGroup.entries()]
    .map(([groupId, pairs]) => {
      const list = copies.filter((c) => c.groupIds.includes(groupId));
      const examIds = new Set([...pairs].map((p) => p.split(":")[0]!));
      return {
        id: groupId,
        label: groupName.get(groupId) ?? "Groupe",
        sublabel: `${new Set([...pairs].map((p) => p.split(":")[1])).size} étudiants`,
        exams: examIds.size,
        copies: list.length,
        participation: participationRate(list.length, pairs.size),
        summary: summarizeCopies(list),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));

  // ── Par module ────────────────────────────────────────────────────────────
  const moduleInfo = new Map(modules.map((m) => [m.id, m]));
  const examsByModule = new Map<string, string[]>();
  for (const e of exams) {
    if (!e.module_id) continue;
    examsByModule.set(e.module_id, [...(examsByModule.get(e.module_id) ?? []), e.id]);
  }
  const byModule: SegmentRow[] = [...examsByModule.entries()]
    .map(([moduleId, examIds]) => {
      const list = copies.filter((c) => c.moduleId === moduleId);
      const enrolledCount = examIds.reduce((s, id) => s + (enrolledByExam.get(id)?.size ?? 0), 0);
      const m = moduleInfo.get(moduleId);
      return {
        id: moduleId,
        label: m?.code ?? "Module",
        sublabel: m?.name ?? null,
        exams: examIds.length,
        copies: list.length,
        participation: participationRate(list.length, enrolledCount),
        summary: summarizeCopies(list),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));

  // ── Étudiants ─────────────────────────────────────────────────────────────
  const nameOf = new Map(enrolled.map((r) => [r.student_id, r.full_name]));
  for (const r of rows) nameOf.set(r.student_id, r.full_name);
  const flaggedBy = new Map<string, number>();
  for (const r of rows)
    if (r.flagged) flaggedBy.set(r.student_id, (flaggedBy.get(r.student_id) ?? 0) + 1);
  const examsOfStudent = new Map<string, Set<string>>();
  const groupsOfStudent = new Map<string, Set<string>>();
  for (const e of enrolled) {
    (
      examsOfStudent.get(e.student_id) ??
      examsOfStudent.set(e.student_id, new Set()).get(e.student_id)!
    ).add(e.exam_id);
    (
      groupsOfStudent.get(e.student_id) ??
      groupsOfStudent.set(e.student_id, new Set()).get(e.student_id)!
    ).add(e.group_id ? (groupName.get(e.group_id) ?? "") : "");
  }
  const progress = studentProgress(copies);
  const withCopies = new Set(progress.map((p) => p.studentId));
  // Inscrits sans aucune copie notée : à suivre en priorité.
  const neverPresent: StudentRow[] = [...examsOfStudent.entries()]
    .filter(([id]) => !withCopies.has(id))
    .map(([id, examIds]) => ({
      studentId: id,
      fullName: nameOf.get(id) ?? "Étudiant",
      groups: [...(groupsOfStudent.get(id) ?? [])].filter(Boolean).sort().join(", "),
      count: 0,
      mean: null,
      last: null,
      delta: null,
      trend: null,
      atRisk: true,
      history: [],
      missed: examIds.size,
      flagged: 0,
    }));
  const students: StudentRow[] = progress
    .map((p): StudentRow => ({
      studentId: p.studentId,
      fullName: nameOf.get(p.studentId) ?? "Étudiant",
      groups: [...(groupsOfStudent.get(p.studentId) ?? [])].filter(Boolean).sort().join(", "),
      count: p.count,
      mean: p.mean,
      last: p.last,
      delta: p.delta,
      trend: p.trend,
      atRisk: p.atRisk,
      history: p.history.map((h) => h.score),
      missed: Math.max(0, (examsOfStudent.get(p.studentId)?.size ?? p.count) - p.count),
      flagged: flaggedBy.get(p.studentId) ?? 0,
    }))
    .concat(neverPresent)
    .sort(
      (a, b) =>
        Number(b.atRisk) - Number(a.atRisk) ||
        (a.mean ?? -1) - (b.mean ?? -1) ||
        a.fullName.localeCompare(b.fullName, "fr"),
    );

  // ── Questions les plus ratées ─────────────────────────────────────────────
  const attemptIds = rows.map((r) => r.attempt_id);
  let hardQuestions: HardQuestion[] = [];
  if (attemptIds.length) {
    const hard = (await db.execute(sql`
      select q.id as question_id, cv.prompt, m.code as module_code,
        count(*)::int as responses,
        count(*) filter (where aq.is_correct)::int as correct,
        count(distinct eq.exam_id)::int as exams
      from attempt_questions aq
      join exam_questions eq on eq.id = aq.exam_question_id
      join question_versions v on v.id = eq.question_version_id
      join questions q on q.id = v.question_id
      join question_versions cv on cv.question_id = q.id and cv.version = q.current_version
      join modules m on m.id = q.module_id
      where aq.attempt_id in (${sql.join(
        attemptIds.map((id) => sql`${id}::uuid`),
        sql`, `,
      )})
        and aq.status in ('REPONDUE', 'EXPIREE')
        and eq.neutralized_at is null
      group by q.id, cv.prompt, m.code
      having count(*) >= ${filters.examId ? 1 : HARD_MIN_RESPONSES}
      order by count(*) filter (where aq.is_correct)::float / count(*) asc, count(*) desc
      limit ${filters.examId ? 100 : 10}
    `)) as unknown as {
      question_id: string;
      prompt: string;
      module_code: string;
      responses: number;
      correct: number;
      exams: number;
    }[];
    hardQuestions = hard.map((h) => ({
      questionId: h.question_id,
      prompt: h.prompt,
      moduleCode: h.module_code,
      responses: h.responses,
      successRate: h.correct / h.responses,
      exams: h.exams,
    }));
  }

  const allEnrolled = [...enrolledByExam.values()].reduce((s, set) => s + set.size, 0);
  const scores = copies.map((c) => c.score);
  const passed = scores.filter((x) => x >= PASS_MARK).length;
  return {
    filters,
    options: {
      modules,
      groups,
      exams: examOptions,
    },
    summary: {
      ...summarizeScores(scores),
      exams: exams.length,
      finishedExams: exams.filter((e) => e.finished).length,
      enrolled: allEnrolled,
      passed,
      failed: scores.length - passed,
      students: new Set(copies.map((c) => c.studentId)).size,
      participation: participationRate(copies.length, allEnrolled),
      flagged: rows.filter((r) => r.flagged).length,
      atRisk: students.filter((s) => s.atRisk).length,
    },
    exams: examPoints,
    byGroup,
    byModule,
    students,
    hardQuestions,
    histogram: histogram(scores),
  };
}

/** Fiche d'un étudiant : ses résultats sur les examens du périmètre de l'utilisateur. */
export async function getStudentReport(
  user: TenantUser,
  studentId: string,
): Promise<StudentReport | null> {
  const db = getDb();
  const [student] = (await db.execute(sql`
    select p.id, p.full_name, p.email,
      (select string_agg(g.name, ', ' order by g.name) from group_members gm
         join groups g on g.id = gm.group_id where gm.profile_id = p.id) as groups
    from profiles p
    where p.id = ${studentId} and p.establishment_id = ${user.establishmentId} and p.role = 'ETUDIANT'
      and ${studentScope(viewerOf(user)) ?? sql`true`}
  `)) as unknown as { id: string; full_name: string; email: string; groups: string | null }[];
  if (!student) return null;

  const scope = examScope(
    user,
    { moduleId: null, groupId: null, examId: null, period: "tout" },
    new Date(),
  );
  const rows = (await db.execute(sql`
    with mine as (
      select distinct e.id as exam_id
      from exams e
      join exam_groups eg on eg.exam_id = e.id
      join group_members gm on gm.group_id = eg.group_id and gm.profile_id = ${studentId}
      where ${scope}
      union
      select e.id from exams e
      join exam_candidates ec on ec.exam_id = e.id and ec.profile_id = ${studentId}
      where ${scope}
    ),
    latest as (
      select distinct on (a.exam_id, a.student_id) a.*
      from attempts a
      where a.exam_id in (select exam_id from mine) and a.status <> 'ANNULEE'
      order by a.exam_id, a.student_id, a.started_at desc
    ),
    graded as (
      select l.exam_id, l.student_id, l.score_out_of_20::float as score,
        rank() over (partition by l.exam_id order by l.score_out_of_20 desc) as rnk,
        avg(l.score_out_of_20) over (partition by l.exam_id) as class_mean,
        count(*) over (partition by l.exam_id) as graded
      from latest l
      where l.status in ${FINISHED} and l.score_out_of_20 is not null
    )
    select e.id as exam_id, e.title, coalesce(e.opens_at, e.created_at) as exam_at,
      m.code as module_code, l.id as attempt_id, l.status, l.violation_count, l.flagged_for_review,
      g.score, g.rnk, g.class_mean,
      (select count(*) from graded g2 where g2.exam_id = e.id)::int as graded_count
    from mine
    join exams e on e.id = mine.exam_id
    left join modules m on m.id = e.module_id
    left join latest l on l.exam_id = e.id and l.student_id = ${studentId}
    left join graded g on g.exam_id = e.id and g.student_id = ${studentId}
    order by exam_at desc
  `)) as unknown as {
    exam_id: string;
    title: string;
    exam_at: string;
    module_code: string | null;
    attempt_id: string | null;
    status: string | null;
    violation_count: number | null;
    flagged_for_review: boolean | null;
    score: number | null;
    rnk: string | null;
    class_mean: string | null;
    graded_count: number;
  }[];

  const exams: StudentReportExam[] = rows.map((r) => ({
    examId: r.exam_id,
    attemptId: r.attempt_id,
    title: r.title,
    examAt: new Date(r.exam_at).toISOString(),
    moduleCode: r.module_code,
    status: r.status ?? "ABSENT",
    score: r.score === null ? null : Number(r.score),
    classMean: r.class_mean === null ? null : Math.round(Number(r.class_mean) * 100) / 100,
    rank: r.rnk === null ? null : Number(r.rnk),
    graded: r.graded_count,
    violationCount: r.violation_count ?? 0,
    flagged: !!r.flagged_for_review,
  }));

  const graded = exams.filter((e) => e.score !== null);
  const progress = studentProgress(
    graded.map((e) => ({
      examId: e.examId,
      examAt: Date.parse(e.examAt),
      moduleId: null,
      studentId,
      groupIds: [],
      score: e.score!,
    })),
  )[0];
  const classMeans = graded.map((e) => e.classMean).filter((v): v is number => v !== null);

  const [practice] = (await db.execute(sql`
    select count(*)::int as n from attempts a join exams e on e.id = a.exam_id
    where a.student_id = ${studentId} and e.is_practice and e.establishment_id = ${user.establishmentId}
      and a.status in ${FINISHED}
  `)) as unknown as { n: number }[];

  return {
    student: {
      id: student.id,
      fullName: student.full_name,
      email: student.email,
      groups: student.groups ?? "",
    },
    exams,
    summary: {
      taken: graded.length,
      missed: exams.filter((e) => e.status === "ABSENT").length,
      mean: progress?.mean ?? null,
      classMean: classMeans.length
        ? Math.round((classMeans.reduce((s, x) => s + x, 0) / classMeans.length) * 100) / 100
        : null,
      delta: progress?.delta ?? null,
      trend: progress?.trend ?? null,
      atRisk: progress?.atRisk ?? false,
      practiceTries: practice?.n ?? 0,
    },
  };
}
