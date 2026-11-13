import "server-only";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { currentAcademicYear } from "@/domain/academic-year";
import { traceAlgorithm } from "@/domain/agsyntax/trace";
import { getDb } from "@/server/db/client";
import {
  groups,
  homeworkGroups,
  homeworkHandins,
  homeworkSteps,
  homeworkSubmissions,
  homeworks,
} from "@/server/db/schema";
import { errors } from "@/server/http/errors";

// ── Personnel ────────────────────────────────────────────────────────────

/** Devoirs de l'année (le formateur ne voit que les siens ; l'admin, tous). */
export async function listHomeworks(
  establishmentId: string,
  year: string,
  authorId: string | null,
) {
  return (await getDb().execute(sql`
    select h.id, h.title, h.session_label as "sessionLabel", h.due_at as "dueAt",
      coalesce(h.due_at < now(), false) as overdue,
      h.is_published as "isPublished",
      (select count(*)::int from homework_steps s where s.homework_id = h.id) as "stepCount",
      (select count(*)::int from homework_handins r where r.homework_id = h.id) as "handinCount",
      (select count(distinct gm.profile_id)::int from homework_groups hg
         join group_members gm on gm.group_id = hg.group_id where hg.homework_id = h.id) as "studentCount",
      coalesce((select array_agg(g.name order by g.name) from homework_groups hg
         join groups g on g.id = hg.group_id where hg.homework_id = h.id), '{}') as "groupNames"
    from homeworks h
    where h.establishment_id = ${establishmentId} and h.academic_year = ${year}
      ${authorId ? sql`and (h.author_id = ${authorId} or h.author_id is null)` : sql``}
    order by coalesce(h.due_at, h.created_at) desc
  `)) as unknown as {
    id: string;
    title: string;
    sessionLabel: string | null;
    dueAt: string | null;
    overdue: boolean;
    isPublished: boolean;
    stepCount: number;
    handinCount: number;
    studentCount: number;
    groupNames: string[];
  }[];
}

export async function getHomeworkForStaff(
  establishmentId: string,
  homeworkId: string,
  authorId: string | null,
) {
  const db = getDb();
  const [homework] = await db
    .select()
    .from(homeworks)
    .where(
      and(
        eq(homeworks.id, homeworkId),
        eq(homeworks.establishmentId, establishmentId),
        authorId
          ? sql`(${homeworks.authorId} = ${authorId} or ${homeworks.authorId} is null)`
          : undefined,
      ),
    )
    .limit(1);
  if (!homework) throw errors.notFound("Devoir introuvable.");
  const [groupRows, steps] = await Promise.all([
    db
      .select({ id: groups.id, name: groups.name })
      .from(homeworkGroups)
      .innerJoin(groups, eq(groups.id, homeworkGroups.groupId))
      .where(eq(homeworkGroups.homeworkId, homeworkId))
      .orderBy(asc(groups.name)),
    db.execute(sql`
      select s.id, s.step_no as "stepNo", s.title,
        jsonb_array_length(s.tests)::int as "testCount",
        (select count(distinct x.student_id)::int from homework_submissions x
           where x.step_id = s.id and x.passed) as "solvedBy",
        (select coalesce(sum(v.views), 0)::int from homework_hint_views v
           where v.step_id = s.id) as "hintViews"
      from homework_steps s where s.homework_id = ${homeworkId}
      order by s.step_no, s.created_at
    `) as unknown as Promise<
      {
        id: string;
        stepNo: number;
        title: string;
        testCount: number;
        solvedBy: number;
        hintViews: number;
      }[]
    >,
  ]);
  return { homework, groups: groupRows, steps };
}

export async function getStepForStaff(
  establishmentId: string,
  stepId: string,
  authorId: string | null,
) {
  const [row] = await getDb()
    .select({ step: homeworkSteps, homework: homeworks })
    .from(homeworkSteps)
    .innerJoin(homeworks, eq(homeworks.id, homeworkSteps.homeworkId))
    .where(
      and(
        eq(homeworkSteps.id, stepId),
        eq(homeworks.establishmentId, establishmentId),
        authorId
          ? sql`(${homeworks.authorId} = ${authorId} or ${homeworks.authorId} is null)`
          : undefined,
      ),
    )
    .limit(1);
  if (!row) throw errors.notFound("Étape introuvable.");
  return row;
}

/**
 * Avancement de chaque stagiaire des groupes du devoir : étapes réussies,
 * indices consultés, statut du rendu. Les stagiaires sans activité figurent aussi.
 */
export async function listHomeworkProgress(homeworkId: string) {
  return (await getDb().execute(sql`
    with students as (
      select distinct p.id, p.full_name
      from homework_groups hg
      join group_members gm on gm.group_id = hg.group_id
      join profiles p on p.id = gm.profile_id
      where hg.homework_id = ${homeworkId} and p.role = 'ETUDIANT'
    )
    select st.id, st.full_name as "fullName",
      (select count(distinct x.step_id)::int from homework_submissions x
         join homework_steps s on s.id = x.step_id
         where s.homework_id = ${homeworkId} and x.student_id = st.id and x.passed) as "stepsPassed",
      (select count(*)::int from homework_submissions x
         join homework_steps s on s.id = x.step_id
         where s.homework_id = ${homeworkId} and x.student_id = st.id) as submissions,
      (select coalesce(sum(v.views), 0)::int from homework_hint_views v
         join homework_steps s on s.id = v.step_id
         where s.homework_id = ${homeworkId} and v.student_id = st.id) as "hintViews",
      (select coalesce(array_agg(s.step_no order by s.step_no), '{}') from homework_hint_views v
         join homework_steps s on s.id = v.step_id
         where s.homework_id = ${homeworkId} and v.student_id = st.id) as "hintSteps",
      greatest(
        (select max(x.created_at) from homework_submissions x
           join homework_steps s on s.id = x.step_id
           where s.homework_id = ${homeworkId} and x.student_id = st.id),
        (select max(v.last_at) from homework_hint_views v
           join homework_steps s on s.id = v.step_id
           where s.homework_id = ${homeworkId} and v.student_id = st.id)
      ) as "lastAt",
      r.submitted_at as "submittedAt", r.is_late as "isLate"
    from students st
    left join homework_handins r on r.homework_id = ${homeworkId} and r.student_id = st.id
    order by (r.submitted_at is null), "stepsPassed" desc, st.full_name
  `)) as unknown as {
    id: string;
    fullName: string;
    stepsPassed: number;
    submissions: number;
    hintViews: number;
    hintSteps: number[];
    lastAt: string | null;
    submittedAt: string | null;
    isLate: boolean | null;
  }[];
}

export async function getHandinForStaff(homeworkId: string, studentId: string) {
  const [row] = await getDb().execute(sql`
    select r.code, r.trace, r.is_late as "isLate", r.submitted_at as "submittedAt",
      p.full_name as "fullName"
    from homework_handins r join profiles p on p.id = r.student_id
    where r.homework_id = ${homeworkId} and r.student_id = ${studentId}
  `);
  return (row ?? null) as {
    code: string;
    trace: typeof homeworkHandins.$inferSelect.trace;
    isLate: boolean;
    submittedAt: string;
    fullName: string;
  } | null;
}

// ── Stagiaire ────────────────────────────────────────────────────────────

/** Devoir visible : publié, de l'année courante, affecté à un groupe du stagiaire. */
function visibleToStudent(studentId: string) {
  return sql`(${homeworks.isPublished} and ${homeworks.academicYear} = ${currentAcademicYear()}
    and exists (
      select 1 from homework_groups hg_v
      join group_members gm_v on gm_v.group_id = hg_v.group_id
      join groups g_v on g_v.id = hg_v.group_id
      where hg_v.homework_id = ${sql.identifier("homeworks")}.id
        and gm_v.profile_id = ${studentId}
        and g_v.academic_year = ${currentAcademicYear()}
    ))`;
}

export async function listStudentHomeworks(studentId: string, establishmentId: string) {
  return (await getDb().execute(sql`
    select homeworks.id, homeworks.title, homeworks.description,
      homeworks.session_label as "sessionLabel", homeworks.due_at as "dueAt",
      coalesce(homeworks.due_at < now(), false) as overdue,
      (select count(*)::int from homework_steps s where s.homework_id = homeworks.id) as "stepCount",
      (select count(distinct x.step_id)::int from homework_submissions x
         join homework_steps s on s.id = x.step_id
         where s.homework_id = homeworks.id and x.student_id = ${studentId} and x.passed) as "stepsPassed",
      exists (select 1 from homework_handins r
         where r.homework_id = homeworks.id and r.student_id = ${studentId}) as "handedIn"
    from homeworks
    where homeworks.establishment_id = ${establishmentId} and ${visibleToStudent(studentId)}
    order by "handedIn", homeworks.due_at nulls last, homeworks.created_at desc
  `)) as unknown as {
    id: string;
    title: string;
    description: string | null;
    sessionLabel: string | null;
    dueAt: string | null;
    overdue: boolean;
    stepCount: number;
    stepsPassed: number;
    handedIn: boolean;
  }[];
}

/** Parcours du devoir : étapes dans l'ordre ; une étape s'ouvre quand la précédente est réussie. */
export async function getStudentHomework(
  studentId: string,
  establishmentId: string,
  homeworkId: string,
) {
  const db = getDb();
  const [homework] = await db
    .select({
      id: homeworks.id,
      title: homeworks.title,
      description: homeworks.description,
      sessionLabel: homeworks.sessionLabel,
      dueAt: homeworks.dueAt,
    })
    .from(homeworks)
    .where(
      and(
        eq(homeworks.id, homeworkId),
        eq(homeworks.establishmentId, establishmentId),
        visibleToStudent(studentId),
      ),
    )
    .limit(1);
  if (!homework) throw errors.notFound("Devoir introuvable.");
  const [stepRows, passedRows, triedRows, [handin]] = await Promise.all([
    db
      .select({ id: homeworkSteps.id, stepNo: homeworkSteps.stepNo, title: homeworkSteps.title })
      .from(homeworkSteps)
      .where(eq(homeworkSteps.homeworkId, homeworkId))
      .orderBy(asc(homeworkSteps.stepNo), asc(homeworkSteps.createdAt)),
    db.execute(sql`
      select distinct x.step_id as id from homework_submissions x
      join homework_steps s on s.id = x.step_id
      where s.homework_id = ${homeworkId} and x.student_id = ${studentId} and x.passed
    `) as unknown as Promise<{ id: string }[]>,
    db.execute(sql`
      select distinct x.step_id as id from homework_submissions x
      join homework_steps s on s.id = x.step_id
      where s.homework_id = ${homeworkId} and x.student_id = ${studentId}
    `) as unknown as Promise<{ id: string }[]>,
    db
      .select({ submittedAt: homeworkHandins.submittedAt })
      .from(homeworkHandins)
      .where(
        and(eq(homeworkHandins.homeworkId, homeworkId), eq(homeworkHandins.studentId, studentId)),
      )
      .limit(1),
  ]);
  const passed = new Set(passedRows.map((r) => r.id));
  const tried = new Set(triedRows.map((r) => r.id));
  let open = true;
  const steps = stepRows.map((s, i) => {
    const unlocked = open;
    if (!passed.has(s.id)) open = false;
    return { ...s, index: i + 1, passed: passed.has(s.id), tried: tried.has(s.id), unlocked };
  });
  const allPassed = steps.length > 0 && steps.every((s) => s.passed);
  const late = !!homework.dueAt && homework.dueAt.getTime() < Date.now();
  return { homework, steps, allPassed, late, handedInAt: handin?.submittedAt ?? null };
}

/** Une étape (contrôle d'accès + ordre), dernière soumission, étape suivante. */
export async function getStudentStep(studentId: string, establishmentId: string, stepId: string) {
  const db = getDb();
  const [step] = await db
    .select({
      id: homeworkSteps.id,
      homeworkId: homeworkSteps.homeworkId,
      title: homeworkSteps.title,
      statement: homeworkSteps.statement,
      starterCode: homeworkSteps.starterCode,
      tests: homeworkSteps.tests,
    })
    .from(homeworkSteps)
    .where(eq(homeworkSteps.id, stepId))
    .limit(1);
  if (!step) throw errors.notFound("Étape introuvable.");
  const view = await getStudentHomework(studentId, establishmentId, step.homeworkId);
  const idx = view.steps.findIndex((s) => s.id === step.id);
  const me = view.steps[idx];
  if (!me?.unlocked) throw errors.forbidden("Réussissez d'abord l'étape précédente.");
  const [last] = await db
    .select({
      code: homeworkSubmissions.code,
      passed: homeworkSubmissions.passed,
      passedCount: homeworkSubmissions.passedCount,
      totalCount: homeworkSubmissions.totalCount,
      results: homeworkSubmissions.results,
    })
    .from(homeworkSubmissions)
    .where(
      and(eq(homeworkSubmissions.studentId, studentId), eq(homeworkSubmissions.stepId, step.id)),
    )
    .orderBy(desc(homeworkSubmissions.createdAt))
    .limit(1);
  const next = view.steps[idx + 1] ?? null;
  return {
    step: {
      id: step.id,
      homeworkId: step.homeworkId,
      index: me.index,
      title: step.title,
      statement: step.statement,
      starterCode: step.starterCode,
      examples: step.tests
        .filter((t) => !t.hidden)
        .map((t) => ({ inputs: t.inputs, expected: t.expected })),
      hiddenCount: step.tests.filter((t) => t.hidden).length,
    },
    homework: view.homework,
    total: view.steps.length,
    passed: me.passed,
    isLast: idx === view.steps.length - 1,
    last,
    next: next ? { id: next.id, title: next.title } : null,
    /** Étape précédente : son code réussi sert de point de départ (on continue dessus). */
    previousId: view.steps[idx - 1]?.id ?? null,
  };
}

/** Dernier code réussi d'une étape (sert de point de départ à l'étape suivante). */
export async function lastPassingCode(studentId: string, stepId: string) {
  const [row] = await getDb()
    .select({ code: homeworkSubmissions.code })
    .from(homeworkSubmissions)
    .where(
      and(
        eq(homeworkSubmissions.studentId, studentId),
        eq(homeworkSubmissions.stepId, stepId),
        eq(homeworkSubmissions.passed, true),
      ),
    )
    .orderBy(desc(homeworkSubmissions.createdAt))
    .limit(1);
  return row?.code ?? null;
}

/**
 * Indice visuel d'une étape (accès déjà vérifié par l'appelant) : seules les images
 * de l'exécution (variables, écran, explications) partent au navigateur, jamais le code.
 */
export async function getStepHintFrames(stepId: string) {
  const [step] = await getDb()
    .select({
      solution: homeworkSteps.solutionCode,
      hintCode: homeworkSteps.hintCode,
      hintInputs: homeworkSteps.hintInputs,
      tests: homeworkSteps.tests,
    })
    .from(homeworkSteps)
    .where(eq(homeworkSteps.id, stepId))
    .limit(1);
  if (!step) return null;
  const code = step.hintCode.trim() ? step.hintCode : step.solution;
  const example = step.tests.find((t) => !t.hidden) ?? step.tests[0];
  const inputs = step.hintInputs ?? example?.inputs ?? [];
  const trace = traceAlgorithm(code, inputs, 120);
  const f = trace.frames;
  if (f.length < 2) return null;
  // Chaque phrase est montrée avec l'état APRÈS son instruction : la case qui change
  // est celle dont on parle. La dernière image (« Fin ») garde son propre état.
  const frames = f.slice(0, -1).map((cur, k) => ({
    explain: cur.explain,
    vars: f[k + 1]!.vars,
    output: f[k + 1]!.screen ?? f[k + 1]!.output,
  }));
  if (!trace.truncated) {
    const end = f.at(-1)!;
    frames.push({
      explain: trace.error ? end.explain : "Terminé : comparez l'écran avec le résultat attendu.",
      vars: end.vars.map((v) => ({ ...v, changed: false })),
      output: end.screen ?? end.output,
    });
  }
  return { inputs, frames };
}
