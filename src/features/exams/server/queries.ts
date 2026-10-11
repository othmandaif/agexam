import "server-only";
import { currentAcademicYear } from "@/domain/academic-year";
import type { StudentPick } from "../schemas";
import { and, asc, desc, eq, gt, ne, sql } from "drizzle-orm";
import type { QuestionOption } from "@/domain/exam-settings";
import type { TenantUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import {
  attempts,
  examCandidates,
  examGroups,
  examQuestions,
  exams,
  groupMembers,
  groups,
  modules,
  profiles,
  questionVersions,
} from "@/server/db/schema";

// Sous-requêtes corrélées : colonnes qualifiées explicitement (cf. comptes).
const examRef = sql`${sql.identifier("exams")}.${sql.identifier("id")}`;
const profileRef = sql`${sql.identifier("profiles")}.${sql.identifier("id")}`;

const questionCountSql = sql<number>`(select count(*)::int from ${examQuestions} eq where eq.exam_id = ${examRef})`;
/** Durée effective : durée globale, ou somme des durées des questions. */
const totalDurationSql = sql<number>`(case when ${exams.timerMode} = 'GLOBAL' then coalesce(${exams.globalDurationSec}, 0) else (select coalesce(sum(eq.duration_sec), 0)::int from ${examQuestions} eq where eq.exam_id = ${examRef}) end)`;
const totalPointsSql = sql<number>`(select coalesce(sum(eq.points), 0)::float from ${examQuestions} eq where eq.exam_id = ${examRef})`;
const attemptCountSql = sql<number>`(select count(*)::int from ${attempts} a where a.exam_id = ${examRef})`;
const groupNamesSql = sql<string | null>`nullif(concat_ws(' + ',
  (select string_agg(g.name, ', ' order by g.name)
     from ${examGroups} eg join ${groups} g on g.id = eg.group_id
    where eg.exam_id = ${examRef}),
  (select case when count(*) = 0 then null
               when count(*) = 1 then '1 étudiant ajouté'
               else count(*) || ' étudiants ajoutés' end
     from ${examCandidates} ec where ec.exam_id = ${examRef})
), '')`;

/** Examens visibles : les siens pour un formateur, tous ceux de l'établissement pour un admin. */
function visibleTo(actor: TenantUser) {
  return and(
    eq(exams.establishmentId, actor.establishmentId),
    actor.role === "ADMIN" ? undefined : eq(exams.authorId, actor.id),
  );
}

export async function listExams(actor: TenantUser, year: string = currentAcademicYear()) {
  return getDb()
    .select({
      id: exams.id,
      title: exams.title,
      status: exams.status,
      opensAt: exams.opensAt,
      closesAt: exams.closesAt,
      accessCode: exams.accessCode,
      isPractice: exams.isPractice,
      updatedAt: exams.updatedAt,
      moduleCode: modules.code,
      authorName: profiles.fullName,
      questionCount: questionCountSql,
      totalDurationSec: totalDurationSql,
      attemptCount: attemptCountSql,
      groupNames: groupNamesSql,
    })
    .from(exams)
    .leftJoin(modules, eq(modules.id, exams.moduleId))
    .leftJoin(profiles, eq(profiles.id, exams.authorId))
    .where(and(visibleTo(actor), ne(exams.status, "ARCHIVE"), eq(exams.academicYear, year)))
    .orderBy(desc(exams.updatedAt))
    .limit(300);
}

export type ExamListItem = Awaited<ReturnType<typeof listExams>>[number];

export const EXAM_TABS = ["TOUS", "OUVERT", "PLANIFIE", "BROUILLON", "FERME", "ARCHIVE"] as const;
export type ExamTab = (typeof EXAM_TABS)[number];

/** État affiché (ExamPhase) traduit en condition SQL, pour filtrer et compter en base. */
function tabCondition(tab: ExamTab, now: string) {
  const at = sql`${now}::timestamptz`;
  const live = sql`${exams.status} in ('PLANIFIE', 'OUVERT')`;
  switch (tab) {
    case "BROUILLON":
      return sql`${exams.status} = 'BROUILLON'`;
    case "ARCHIVE":
      return sql`${exams.status} = 'ARCHIVE'`;
    case "FERME":
      return sql`(${exams.status} = 'FERME' or (${live} and ${exams.closesAt} <= ${at}))`;
    case "OUVERT":
      return sql`(${live} and ${exams.opensAt} <= ${at} and (${exams.closesAt} is null or ${exams.closesAt} > ${at}))`;
    case "PLANIFIE":
      return sql`(${live} and (${exams.opensAt} is null or ${exams.opensAt} > ${at}))`;
    default:
      return sql`${exams.status} <> 'ARCHIVE'`;
  }
}

export interface ExamListFilters {
  tab: ExamTab;
  moduleId: string | null;
  groupId: string | null;
  q: string;
  offset: number;
  limit: number;
  /** Année scolaire affichée (défaut : courante). */
  year?: string;
}

/**
 * Liste paginée en base : filtres module, groupe, recherche et état appliqués
 * dans la requête, seule la page demandée est lue. Compte par onglet inclus.
 */
export async function listExamsPage(actor: TenantUser, f: ExamListFilters) {
  const db = getDb();
  const now = new Date().toISOString();
  const base = and(
    visibleTo(actor),
    eq(exams.academicYear, f.year ?? currentAcademicYear()),
    f.moduleId ? eq(exams.moduleId, f.moduleId) : undefined,
    f.groupId
      ? sql`exists (select 1 from ${examGroups} eg where eg.exam_id = ${examRef} and eg.group_id = ${f.groupId})`
      : undefined,
    f.q ? sql`${exams.title} ilike ${`%${f.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`}` : undefined,
  );
  const countsQuery = db
    .select(
      Object.fromEntries(
        EXAM_TABS.map((t) => [
          t,
          sql<number>`count(*) filter (where ${tabCondition(t, now)})::int`,
        ]),
      ) as Record<ExamTab, ReturnType<typeof sql<number>>>,
    )
    .from(exams)
    .where(base);
  const rowsQuery = db
    .select({
      id: exams.id,
      title: exams.title,
      status: exams.status,
      opensAt: exams.opensAt,
      closesAt: exams.closesAt,
      accessCode: exams.accessCode,
      isPractice: exams.isPractice,
      updatedAt: exams.updatedAt,
      moduleCode: modules.code,
      authorName: profiles.fullName,
      questionCount: questionCountSql,
      totalDurationSec: totalDurationSql,
      attemptCount: attemptCountSql,
      groupNames: groupNamesSql,
    })
    .from(exams)
    .leftJoin(modules, eq(modules.id, exams.moduleId))
    .leftJoin(profiles, eq(profiles.id, exams.authorId))
    .where(and(base, tabCondition(f.tab, now)))
    .orderBy(desc(exams.updatedAt), desc(exams.id))
    .limit(f.limit)
    .offset(f.offset);
  const [[counts], rows] = await Promise.all([countsQuery, rowsQuery]);
  return {
    rows,
    counts: counts as Record<ExamTab, number>,
    total: (counts as Record<ExamTab, number>)[f.tab],
  };
}

/** Examen complet avec ses questions (bonnes réponses incluses : réservé au formateur). */
export async function getExamDetail(actor: TenantUser, examId: string) {
  const db = getDb();
  const [exam] = await db
    .select({
      id: exams.id,
      title: exams.title,
      description: exams.description,
      status: exams.status,
      opensAt: exams.opensAt,
      closesAt: exams.closesAt,
      accessCode: exams.accessCode,
      isPractice: exams.isPractice,
      timerMode: exams.timerMode,
      globalDurationSec: exams.globalDurationSec,
      sourceText: exams.sourceText,
      moduleId: exams.moduleId,
      moduleCode: modules.code,
      moduleName: modules.name,
      authorId: exams.authorId,
      authorName: profiles.fullName,
      violationPolicy: exams.violationPolicy,
      securitySettings: exams.securitySettings,
      resultVisibility: exams.resultVisibility,
      resultReleaseMode: exams.resultReleaseMode,
      questionCount: questionCountSql,
      totalDurationSec: totalDurationSql,
      totalPoints: totalPointsSql,
      attemptCount: attemptCountSql,
    })
    .from(exams)
    .leftJoin(modules, eq(modules.id, exams.moduleId))
    .leftJoin(profiles, eq(profiles.id, exams.authorId))
    .where(and(eq(exams.id, examId), visibleTo(actor)))
    .limit(1);
  if (!exam) return null;

  const [examGroupRows, questionRows, candidateRows] = await Promise.all([
    db
      .select({ id: groups.id, name: groups.name })
      .from(examGroups)
      .innerJoin(groups, eq(groups.id, examGroups.groupId))
      .where(eq(examGroups.examId, examId))
      .orderBy(asc(groups.name)),
    db
      .select({
        id: examQuestions.id,
        position: examQuestions.position,
        durationSec: examQuestions.durationSec,
        points: examQuestions.points,
        prompt: questionVersions.prompt,
        code: questionVersions.code,
        codeLanguage: questionVersions.codeLanguage,
        options: questionVersions.options,
        explanation: questionVersions.explanation,
      })
      .from(examQuestions)
      .innerJoin(questionVersions, eq(questionVersions.id, examQuestions.questionVersionId))
      .where(eq(examQuestions.examId, examId))
      .orderBy(asc(examQuestions.position)),
    db
      .select({
        id: profiles.id,
        fullName: profiles.fullName,
        email: profiles.email,
        groups: sql<string>`coalesce((select string_agg(g.name, ', ' order by g.name)
          from ${groupMembers} gm join ${groups} g on g.id = gm.group_id
          where gm.profile_id = ${profileRef}), '')`,
      })
      .from(examCandidates)
      .innerJoin(profiles, eq(profiles.id, examCandidates.profileId))
      .where(eq(examCandidates.examId, examId))
      .orderBy(asc(profiles.fullName)),
  ]);

  return {
    ...exam,
    groups: examGroupRows,
    candidates: candidateRows,
    questions: questionRows as (Omit<(typeof questionRows)[number], "options"> & {
      options: QuestionOption[];
    })[],
  };
}

export type ExamDetail = NonNullable<Awaited<ReturnType<typeof getExamDetail>>>;

/** Listes pour l'éditeur : modules et groupes de l'établissement. */
export async function getEditorOptions(establishmentId: string) {
  const db = getDb();
  const [moduleRows, groupRows] = await Promise.all([
    db
      .select({ id: modules.id, code: modules.code, name: modules.name })
      .from(modules)
      .where(eq(modules.establishmentId, establishmentId))
      .orderBy(asc(modules.code)),
    db
      .select({
        id: groups.id,
        name: groups.name,
        memberCount: db.$count(groupMembers, eq(groupMembers.groupId, groups.id)),
      })
      .from(groups)
      .where(
        and(
          eq(groups.establishmentId, establishmentId),
          eq(groups.academicYear, currentAcademicYear()),
        ),
      )
      .orderBy(asc(groups.name)),
  ]);
  return { modules: moduleRows, groups: groupRows };
}

/** Examens publiés, pas encore fermés, des groupes de l'étudiant. */
export async function listStudentUpcomingExams(studentId: string, establishmentId: string) {
  const db = getDb();
  // Examens de ses groupes + ceux où il a été ajouté individuellement.
  const examIds = sql`(
    select eg.exam_id from ${examGroups} eg
    join ${groupMembers} gm on gm.group_id = eg.group_id
    where gm.profile_id = ${studentId}
    union
    select ec.exam_id from ${examCandidates} ec where ec.profile_id = ${studentId}
  )`;

  return db
    .select({
      id: exams.id,
      title: exams.title,
      opensAt: exams.opensAt,
      closesAt: exams.closesAt,
      status: exams.status,
      isPractice: exams.isPractice,
      moduleCode: modules.code,
      authorName: profiles.fullName,
      questionCount: questionCountSql,
      totalDurationSec: totalDurationSql,
    })
    .from(exams)
    .leftJoin(modules, eq(modules.id, exams.moduleId))
    .leftJoin(profiles, eq(profiles.id, exams.authorId))
    .where(
      and(
        eq(exams.establishmentId, establishmentId),
        sql`${exams.id} in ${examIds}`,
        ne(exams.status, "BROUILLON"),
        ne(exams.status, "ARCHIVE"),
        ne(exams.status, "FERME"),
        gt(exams.closesAt, new Date()),
      ),
    )
    .orderBy(asc(exams.opensAt))
    .limit(20);
}

/** Recherche d'étudiants de l'établissement (ajout individuel à un examen). */
export async function searchStudents(
  establishmentId: string,
  q: string,
  exclude: string[],
): Promise<StudentPick[]> {
  const term = q
    .trim()
    .slice(0, 80)
    .replace(/[\\%_]/g, (c) => `\\${c}`);
  if (term.length < 2) return [];
  const rows = await getDb()
    .select({
      id: profiles.id,
      fullName: profiles.fullName,
      email: profiles.email,
      groups: sql<string>`coalesce((select string_agg(g.name, ', ' order by g.name)
        from ${groupMembers} gm join ${groups} g on g.id = gm.group_id
        where gm.profile_id = ${profileRef}), '')`,
    })
    .from(profiles)
    .where(
      and(
        eq(profiles.establishmentId, establishmentId),
        eq(profiles.role, "ETUDIANT"),
        eq(profiles.isActive, true),
        eq(profiles.academicYear, currentAcademicYear()),
        sql`(${profiles.fullName} ilike ${`%${term}%`} or ${profiles.email} ilike ${`%${term}%`})`,
        exclude.length
          ? sql`${profiles.id} not in (${sql.join(
              exclude.map((id) => sql`${id}::uuid`),
              sql`, `,
            )})`
          : undefined,
      ),
    )
    .orderBy(asc(profiles.fullName))
    .limit(12);
  return rows;
}
