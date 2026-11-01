"use server";

import { groupScope, viewerOf } from "@/server/scope";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentAcademicYear } from "@/domain/academic-year";
import { freezeExpected, MAX_TESTS, runTest } from "@/domain/agsyntax/testing";
import type { ActionState } from "@/lib/action-state";
import { ROUTES, paths } from "@/lib/routes";
import { actionError } from "@/server/actions/result";
import { audit } from "@/server/audit";
import { requireTenant } from "@/server/auth/session";
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
import { assertCurrentYear } from "@/server/year";
import {
  exerciseIdSchema,
  exerciseSchema,
  submissionSchema,
  trackIdSchema,
  trackSchema,
  trackUpdateSchema,
} from "../schemas";
import { xpForExercise } from "../gamification";
import { parseExercisesText } from "../text";
import { getStudentExercise } from "./queries";

type State = ActionState<unknown>;
const STAFF = ["FORMATEUR", "ADMIN"] as const;

async function editableTrack(trackId: string, establishmentId: string) {
  const [row] = await getDb()
    .select({ id: algoTracks.id, title: algoTracks.title, academicYear: algoTracks.academicYear })
    .from(algoTracks)
    .where(and(eq(algoTracks.id, trackId), eq(algoTracks.establishmentId, establishmentId)))
    .limit(1);
  if (!row) throw errors.notFound("Parcours introuvable.");
  assertCurrentYear(row.academicYear, "Ce parcours");
  return row;
}

export async function createTrackAction(_prev: State, formData: FormData): Promise<State> {
  let trackId: string;
  try {
    const user = await requireTenant(...STAFF);
    const input = trackSchema.parse(Object.fromEntries(formData));
    const [row] = await getDb()
      .insert(algoTracks)
      .values({ ...input, establishmentId: user.establishmentId, authorId: user.id })
      .returning({ id: algoTracks.id });
    trackId = row!.id;
    revalidatePath(ROUTES.trainer.training);
  } catch (error) {
    return actionError(error);
  }
  redirect(paths.track(trackId));
}

export async function updateTrackAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant(...STAFF);
    const input = trackUpdateSchema.parse({
      trackId: formData.get("trackId"),
      title: formData.get("title") ?? "",
      description: formData.get("description") ?? "",
      isPublished: formData.get("isPublished") === "on",
      groupIds: formData.getAll("groupId"),
    });
    await editableTrack(input.trackId, user.establishmentId);
    const db = getDb();
    // Seuls les groupes de l'établissement et de l'année courante.
    const valid = input.groupIds.length
      ? await db
          .select({ id: groups.id })
          .from(groups)
          .where(
            and(
              inArray(groups.id, input.groupIds),
              eq(groups.establishmentId, user.establishmentId),
              eq(groups.academicYear, currentAcademicYear()),
              groupScope(viewerOf(user)),
            ),
          )
      : [];
    if (input.isPublished && valid.length === 0) {
      throw errors.badRequest("Choisissez au moins un groupe avant de publier.");
    }
    if (input.isPublished) {
      const count = await db.$count(algoExercises, eq(algoExercises.trackId, input.trackId));
      if (count === 0) throw errors.badRequest("Ajoutez au moins un exercice avant de publier.");
    }
    await db.transaction(async (tx) => {
      await tx
        .update(algoTracks)
        .set({
          title: input.title,
          description: input.description,
          isPublished: input.isPublished,
          updatedAt: new Date(),
        })
        .where(eq(algoTracks.id, input.trackId));
      await tx.delete(algoTrackGroups).where(eq(algoTrackGroups.trackId, input.trackId));
      if (valid.length) {
        await tx
          .insert(algoTrackGroups)
          .values(valid.map((g) => ({ trackId: input.trackId, groupId: g.id })));
      }
    });
    revalidatePath(paths.track(input.trackId));
    revalidatePath(ROUTES.trainer.training);
    return { status: "success", message: "Parcours enregistré." };
  } catch (error) {
    return actionError(error);
  }
}

/** Suppression explicite (confirmée) : les soumissions des étudiants partent avec. */
export async function deleteTrackAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant(...STAFF);
    const { trackId } = trackIdSchema.parse(Object.fromEntries(formData));
    const track = await editableTrack(trackId, user.establishmentId);
    const db = getDb();
    await db.transaction(async (tx) => {
      const [{ n }] = (await tx.execute(sql`
        select count(*)::int as n from algo_submissions s
        join algo_exercises e on e.id = s.exercise_id where e.track_id = ${trackId}
      `)) as unknown as [{ n: number }];
      await tx.delete(algoTracks).where(eq(algoTracks.id, trackId));
      await audit(tx, {
        actorId: user.id,
        action: "training.track.delete",
        entityType: "algo_track",
        entityId: trackId,
        payload: { title: track.title, submissions: n },
      });
    });
  } catch (error) {
    return actionError(error);
  }
  revalidatePath(ROUTES.trainer.training);
  redirect(ROUTES.trainer.training);
}

/**
 * Enregistre un exercice : le corrigé est exécuté sur chaque jeu d'essai et
 * les sorties attendues sont figées. Refusé si le corrigé échoue.
 */
export async function saveExerciseAction(_prev: State, formData: FormData): Promise<State> {
  let target: Route;
  try {
    const user = await requireTenant(...STAFF);
    let payload: unknown;
    try {
      payload = JSON.parse(String(formData.get("payload") ?? "{}"));
    } catch {
      throw errors.badRequest("Données invalides.");
    }
    const input = exerciseSchema.parse(payload);
    await editableTrack(input.trackId, user.establishmentId);
    const frozen = freezeExpected(input.solutionCode, input.tests.slice(0, MAX_TESTS));
    if (!frozen.ok) {
      const where = frozen.error.line ? ` (ligne ${frozen.error.line})` : "";
      throw errors.badRequest(
        `Le corrigé échoue sur le jeu d'essai ${frozen.index + 1}${where} : ${frozen.error.message}`,
      );
    }
    const db = getDb();
    const values = {
      level: input.level,
      title: input.title,
      statement: input.statement,
      starterCode: input.starterCode,
      solutionCode: input.solutionCode,
      tests: frozen.tests,
      updatedAt: new Date(),
    };
    let exerciseId = input.exerciseId;
    if (exerciseId) {
      const updated = await db
        .update(algoExercises)
        .set(values)
        .where(and(eq(algoExercises.id, exerciseId), eq(algoExercises.trackId, input.trackId)))
        .returning({ id: algoExercises.id });
      if (updated.length === 0) throw errors.notFound("Exercice introuvable.");
    } else {
      const [{ pos }] = (await db.execute(sql`
        select coalesce(max(position), -1)::int + 1 as pos from algo_exercises
        where track_id = ${input.trackId} and level = ${input.level}
      `)) as unknown as [{ pos: number }];
      const [row] = await db
        .insert(algoExercises)
        .values({ ...values, trackId: input.trackId, position: pos })
        .returning({ id: algoExercises.id });
      exerciseId = row!.id;
    }
    revalidatePath(paths.track(input.trackId));
    target = paths.exercise(input.trackId, exerciseId);
    if (input.exerciseId) {
      revalidatePath(target);
      return { status: "success", message: "Exercice enregistré, sorties attendues figées." };
    }
  } catch (error) {
    return actionError(error);
  }
  redirect(`${target}?cree=1` as Route);
}

export async function deleteExerciseAction(_prev: State, formData: FormData): Promise<State> {
  let trackId: string;
  try {
    const user = await requireTenant(...STAFF);
    const { exerciseId } = exerciseIdSchema.parse(Object.fromEntries(formData));
    const [row] = await getDb()
      .select({ trackId: algoExercises.trackId, title: algoExercises.title })
      .from(algoExercises)
      .where(eq(algoExercises.id, exerciseId))
      .limit(1);
    if (!row) throw errors.notFound("Exercice introuvable.");
    await editableTrack(row.trackId, user.establishmentId);
    trackId = row.trackId;
    await getDb().transaction(async (tx) => {
      await tx.delete(algoExercises).where(eq(algoExercises.id, exerciseId));
      await audit(tx, {
        actorId: user.id,
        action: "training.exercise.delete",
        entityType: "algo_exercise",
        entityId: exerciseId,
        payload: { title: row.title },
      });
    });
  } catch (error) {
    return actionError(error);
  }
  revalidatePath(paths.track(trackId));
  redirect(paths.track(trackId));
}

// ── Étudiant ─────────────────────────────────────────────────────────────

export interface SubmissionView {
  passed: boolean;
  passedCount: number;
  totalCount: number;
  results: AlgoTestResult[];
  justUnlocked: boolean;
  /** Points gagnés par cette soumission (première réussite seulement). */
  xpGained: number;
}

/** Soumission : tous les jeux d'essai sont exécutés côté serveur (corrigé jamais exposé). */
export async function submitExerciseAction(
  _prev: ActionState<SubmissionView>,
  formData: FormData,
): Promise<ActionState<SubmissionView>> {
  try {
    const user = await requireTenant("ETUDIANT");
    const input = submissionSchema.parse(Object.fromEntries(formData));
    // Contrôle d'accès + niveau ouvert (lève une erreur sinon).
    const view = await getStudentExercise(user.id, user.establishmentId, input.exerciseId);
    const [ex] = await getDb()
      .select({ tests: algoExercises.tests })
      .from(algoExercises)
      .where(eq(algoExercises.id, input.exerciseId))
      .limit(1);
    if (!ex) throw errors.notFound("Exercice introuvable.");

    const results: AlgoTestResult[] = ex.tests.map((t) => {
      const r = runTest(input.code, t);
      const error = r.error
        ? `${r.error.line ? `Ligne ${r.error.line} : ` : ""}${r.error.message}`
        : undefined;
      return t.hidden
        ? { passed: r.passed, hidden: true }
        : {
            passed: r.passed,
            hidden: false,
            inputs: t.inputs,
            expected: t.expected,
            got: r.got.slice(0, 4000),
            error,
          };
    });
    const passedCount = results.filter((r) => r.passed).length;
    const passed = passedCount === results.length && results.length > 0;
    await getDb().insert(algoSubmissions).values({
      exerciseId: input.exerciseId,
      studentId: user.id,
      code: input.code,
      passed,
      passedCount,
      totalCount: results.length,
      results,
    });
    // Dernier exercice du niveau réussi → le niveau suivant s'ouvre.
    const nextLevel = view.levels.find((l) => l.level > view.exercise.level);
    const justUnlocked = passed && view.levelRemaining === 0 && !!nextLevel && !nextLevel.unlocked;
    const xpGained =
      passed && !view.solved ? xpForExercise(view.exercise.level, view.last === null) : 0;
    revalidatePath(ROUTES.student.training);
    return {
      status: "success",
      data: { passed, passedCount, totalCount: results.length, results, justUnlocked, xpGained },
    };
  } catch (error) {
    return actionError(error);
  }
}

/**
 * Import en une fois (format texte) : chaque corrigé est exécuté sur ses jeux
 * d'essai, sorties figées. Tout ou rien : une erreur et rien n'est importé.
 */
export async function importExercisesAction(_prev: State, formData: FormData): Promise<State> {
  let trackId: string;
  try {
    const user = await requireTenant(...STAFF);
    trackId = trackIdSchema.parse({ trackId: formData.get("trackId") }).trackId;
    await editableTrack(trackId, user.establishmentId);
    const { exercises, globalErrors } = parseExercisesText(String(formData.get("text") ?? ""));
    if (globalErrors.length) throw errors.badRequest(globalErrors[0]!);
    if (exercises.length === 0) throw errors.badRequest("Aucun exercice trouvé.");
    const bad = exercises.find((e) => e.errors.length);
    if (bad)
      throw errors.badRequest(`Exercice ${bad.number} (« ${bad.title} ») : ${bad.errors[0]}`);
    const rows = exercises.map((e) => {
      const frozen = freezeExpected(e.solutionCode, e.tests);
      if (!frozen.ok) {
        throw errors.badRequest(
          `Exercice ${e.number} (« ${e.title} ») : le corrigé échoue sur le jeu ${frozen.index + 1}${
            frozen.error.line ? ` (ligne ${frozen.error.line})` : ""
          } : ${frozen.error.message}`,
        );
      }
      return { e, tests: frozen.tests };
    });
    const db = getDb();
    await db.transaction(async (tx) => {
      const existing = (await tx.execute(sql`
        select level, coalesce(max(position), -1)::int as pos from algo_exercises
        where track_id = ${trackId} group by level
      `)) as unknown as { level: number; pos: number }[];
      const next = new Map(existing.map((r) => [r.level, r.pos + 1]));
      await tx.insert(algoExercises).values(
        rows.map(({ e, tests }) => {
          const position = next.get(e.level) ?? 0;
          next.set(e.level, position + 1);
          return {
            trackId,
            level: e.level,
            position,
            title: e.title,
            statement: e.statement,
            starterCode: e.starterCode,
            solutionCode: e.solutionCode,
            tests,
          };
        }),
      );
    });
    revalidatePath(paths.track(trackId));
  } catch (error) {
    return actionError(error);
  }
  redirect(`${paths.track(trackId)}?importes=1` as Route);
}
