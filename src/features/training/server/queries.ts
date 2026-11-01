import "server-only";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { currentAcademicYear } from "@/domain/academic-year";
import { getDb } from "@/server/db/client";
import {
  algoExercises,
  algoSubmissions,
  algoTrackGroups,
  algoTracks,
  groups,
  type AlgoTestResult,
} from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import { computeBadges, computeXp, xpForExercise } from "../gamification";
import { unlockedLevels } from "../progress";

// ── Personnel ────────────────────────────────────────────────────────────

export async function listTracks(establishmentId: string, year: string) {
  const rows = (await getDb().execute(sql`
    select t.id, t.title, t.description, t.is_published as "isPublished",
      (select count(*)::int from algo_exercises e where e.track_id = t.id) as "exerciseCount",
      (select count(distinct e.level)::int from algo_exercises e where e.track_id = t.id) as "levelCount",
      (select count(distinct s.student_id)::int from algo_submissions s
         join algo_exercises e on e.id = s.exercise_id where e.track_id = t.id) as "studentCount",
      coalesce((select array_agg(g.name order by g.name) from algo_track_groups tg
         join groups g on g.id = tg.group_id where tg.track_id = t.id), '{}') as "groupNames"
    from algo_tracks t
    where t.establishment_id = ${establishmentId} and t.academic_year = ${year}
    order by t.created_at desc
  `)) as unknown as {
    id: string;
    title: string;
    description: string | null;
    isPublished: boolean;
    exerciseCount: number;
    levelCount: number;
    studentCount: number;
    groupNames: string[];
  }[];
  return rows;
}

export async function getTrackForStaff(establishmentId: string, trackId: string) {
  const db = getDb();
  const [track] = await db
    .select()
    .from(algoTracks)
    .where(and(eq(algoTracks.id, trackId), eq(algoTracks.establishmentId, establishmentId)))
    .limit(1);
  if (!track) throw errors.notFound("Parcours introuvable.");
  const [groupRows, exercises] = await Promise.all([
    db
      .select({ id: groups.id, name: groups.name })
      .from(algoTrackGroups)
      .innerJoin(groups, eq(groups.id, algoTrackGroups.groupId))
      .where(eq(algoTrackGroups.trackId, trackId))
      .orderBy(asc(groups.name)),
    db.execute(sql`
      select e.id, e.level, e.position, e.title,
        jsonb_array_length(e.tests)::int as "testCount",
        (select count(distinct s.student_id)::int from algo_submissions s
           where s.exercise_id = e.id and s.passed) as "solvedBy",
        (select count(distinct s.student_id)::int from algo_submissions s
           where s.exercise_id = e.id) as "triedBy"
      from algo_exercises e where e.track_id = ${trackId}
      order by e.level, e.position, e.created_at
    `) as unknown as Promise<
      {
        id: string;
        level: number;
        position: number;
        title: string;
        testCount: number;
        solvedBy: number;
        triedBy: number;
      }[]
    >,
  ]);
  return { track, groups: groupRows, exercises };
}

export async function getExerciseForStaff(establishmentId: string, exerciseId: string) {
  const [row] = await getDb()
    .select({ exercise: algoExercises, track: algoTracks })
    .from(algoExercises)
    .innerJoin(algoTracks, eq(algoTracks.id, algoExercises.trackId))
    .where(and(eq(algoExercises.id, exerciseId), eq(algoTracks.establishmentId, establishmentId)))
    .limit(1);
  if (!row) throw errors.notFound("Exercice introuvable.");
  return row;
}

/** Progression des étudiants sur un parcours (tableau du formateur). */
export async function listTrackProgress(trackId: string) {
  return (await getDb().execute(sql`
    select p.id, p.full_name as "fullName",
      count(distinct s.exercise_id) filter (where s.passed)::int as solved,
      count(*)::int as submissions,
      max(s.created_at) as "lastAt"
    from algo_submissions s
    join algo_exercises e on e.id = s.exercise_id
    join profiles p on p.id = s.student_id
    where e.track_id = ${trackId}
    group by p.id, p.full_name
    order by solved desc, p.full_name
  `)) as unknown as {
    id: string;
    fullName: string;
    solved: number;
    submissions: number;
    lastAt: string;
  }[];
}

// ── Étudiant ─────────────────────────────────────────────────────────────

/** Parcours visible : publié, de l'année courante, affecté à un groupe (année courante) de l'étudiant. */
function visibleToStudent(studentId: string) {
  return sql`(${algoTracks.isPublished} and ${algoTracks.academicYear} = ${currentAcademicYear()}
    and exists (
      select 1 from algo_track_groups tg_v
      join group_members gm_v on gm_v.group_id = tg_v.group_id
      join groups g_v on g_v.id = tg_v.group_id
      where tg_v.track_id = ${sql.identifier("algo_tracks")}.id
        and gm_v.profile_id = ${studentId}
        and g_v.academic_year = ${currentAcademicYear()}
    ))`;
}

export async function listStudentTracks(studentId: string, establishmentId: string) {
  return (await getDb().execute(sql`
    select algo_tracks.id, algo_tracks.title, algo_tracks.description,
      (select count(*)::int from algo_exercises e where e.track_id = algo_tracks.id) as "exerciseCount",
      (select count(distinct e.level)::int from algo_exercises e where e.track_id = algo_tracks.id) as "levelCount",
      (select count(distinct s.exercise_id)::int from algo_submissions s
         join algo_exercises e on e.id = s.exercise_id
         where e.track_id = algo_tracks.id and s.student_id = ${studentId} and s.passed) as solved,
      coalesce((select sum(10 * e.level + case when (
          select s1.passed from algo_submissions s1
          where s1.exercise_id = e.id and s1.student_id = ${studentId}
          order by s1.created_at limit 1) then 5 else 0 end)
        from algo_exercises e
        where e.track_id = algo_tracks.id and exists (
          select 1 from algo_submissions s2
          where s2.exercise_id = e.id and s2.student_id = ${studentId} and s2.passed)), 0)::int as xp
    from algo_tracks
    where algo_tracks.establishment_id = ${establishmentId} and ${visibleToStudent(studentId)}
    order by algo_tracks.created_at
  `)) as unknown as {
    id: string;
    title: string;
    description: string | null;
    exerciseCount: number;
    levelCount: number;
    solved: number;
    xp: number;
  }[];
}

async function studentTrackOrThrow(studentId: string, establishmentId: string, trackId: string) {
  const [track] = await getDb()
    .select({ id: algoTracks.id, title: algoTracks.title, description: algoTracks.description })
    .from(algoTracks)
    .where(
      and(
        eq(algoTracks.id, trackId),
        eq(algoTracks.establishmentId, establishmentId),
        visibleToStudent(studentId),
      ),
    )
    .limit(1);
  if (!track) throw errors.notFound("Parcours introuvable.");
  return track;
}

/** Parcours de l'étudiant : exercices par niveau, réussis, tentés, niveaux ouverts. */
export async function getStudentTrack(studentId: string, establishmentId: string, trackId: string) {
  const track = await studentTrackOrThrow(studentId, establishmentId, trackId);
  const db = getDb();
  const exercises = await db
    .select({
      id: algoExercises.id,
      level: algoExercises.level,
      title: algoExercises.title,
    })
    .from(algoExercises)
    .where(eq(algoExercises.trackId, trackId))
    .orderBy(asc(algoExercises.level), asc(algoExercises.position), asc(algoExercises.createdAt));
  const ids = exercises.map((e) => e.id);
  const subs = ids.length
    ? await db
        .select({ exerciseId: algoSubmissions.exerciseId, passed: algoSubmissions.passed })
        .from(algoSubmissions)
        .where(
          and(eq(algoSubmissions.studentId, studentId), inArray(algoSubmissions.exerciseId, ids)),
        )
        .orderBy(asc(algoSubmissions.createdAt))
    : [];
  // Essais par exercice et réussite dès la première soumission (points bonus).
  const stats = new Map<string, { attempts: number; firstTry: boolean }>();
  for (const s of subs) {
    const st = stats.get(s.exerciseId) ?? { attempts: 0, firstTry: false };
    if (st.attempts === 0 && s.passed) st.firstTry = true;
    st.attempts++;
    stats.set(s.exerciseId, st);
  }
  const solved = new Set(subs.filter((s) => s.passed).map((s) => s.exerciseId));
  const tried = new Set(subs.map((s) => s.exerciseId));
  const open = unlockedLevels(exercises, solved);
  const levels = [...new Set(exercises.map((e) => e.level))].map((level) => ({
    level,
    unlocked: open.has(level),
    exercises: exercises
      .filter((e) => e.level === level)
      .map((e) => {
        const st = stats.get(e.id);
        const isSolved = solved.has(e.id);
        return {
          ...e,
          solved: isSolved,
          tried: tried.has(e.id),
          attempts: st?.attempts ?? 0,
          firstTry: isSolved && !!st?.firstTry,
          xp: xpForExercise(e.level, isSolved && !!st?.firstTry),
        };
      }),
  }));
  const progress = levels.flatMap((l) => l.exercises);
  const xp = computeXp(progress);
  return {
    track,
    levels,
    solvedCount: solved.size,
    total: exercises.length,
    xp,
    maxXp: progress.reduce((s, e) => s + xpForExercise(e.level, true), 0),
    badges: computeBadges(progress),
  };
}

/**
 * Exercice pour l'étudiant : jamais le corrigé, jamais les sorties des jeux
 * cachés. Refusé si le niveau est encore verrouillé.
 */
export async function getStudentExercise(
  studentId: string,
  establishmentId: string,
  exerciseId: string,
) {
  const db = getDb();
  const [ex] = await db
    .select({
      id: algoExercises.id,
      trackId: algoExercises.trackId,
      level: algoExercises.level,
      title: algoExercises.title,
      statement: algoExercises.statement,
      starterCode: algoExercises.starterCode,
      tests: algoExercises.tests,
    })
    .from(algoExercises)
    .where(eq(algoExercises.id, exerciseId))
    .limit(1);
  if (!ex) throw errors.notFound("Exercice introuvable.");
  const view = await getStudentTrack(studentId, establishmentId, ex.trackId);
  const level = view.levels.find((l) => l.level === ex.level);
  if (!level?.unlocked) throw errors.forbidden("Ce niveau est encore verrouillé.");

  const [last] = await db
    .select({
      code: algoSubmissions.code,
      passed: algoSubmissions.passed,
      passedCount: algoSubmissions.passedCount,
      totalCount: algoSubmissions.totalCount,
      results: algoSubmissions.results,
      createdAt: algoSubmissions.createdAt,
    })
    .from(algoSubmissions)
    .where(and(eq(algoSubmissions.studentId, studentId), eq(algoSubmissions.exerciseId, ex.id)))
    .orderBy(desc(algoSubmissions.createdAt))
    .limit(1);

  const flat = view.levels.flatMap((l) => l.exercises.map((e) => ({ ...e, unlocked: l.unlocked })));
  const idx = flat.findIndex((e) => e.id === ex.id);
  const next = flat.slice(idx + 1).find((e) => !e.solved) ?? null;
  return {
    exercise: {
      id: ex.id,
      trackId: ex.trackId,
      level: ex.level,
      title: ex.title,
      statement: ex.statement,
      starterCode: ex.starterCode,
      examples: ex.tests
        .filter((t) => !t.hidden)
        .map((t) => ({ inputs: t.inputs, expected: t.expected })),
      hiddenCount: ex.tests.filter((t) => t.hidden).length,
    },
    track: view.track,
    solved: view.levels.some((l) => l.exercises.some((e) => e.id === ex.id && e.solved)),
    last: last ? { ...last, results: last.results as AlgoTestResult[] } : null,
    next: next ? { id: next.id, title: next.title, unlocked: next.unlocked } : null,
    levels: view.levels.map((l) => ({ level: l.level, unlocked: l.unlocked })),
    /** Exercices du niveau encore non réussis, hors celui-ci. */
    levelRemaining:
      view.levels
        .find((l) => l.level === ex.level)
        ?.exercises.filter((e) => !e.solved && e.id !== ex.id).length ?? 0,
  };
}
