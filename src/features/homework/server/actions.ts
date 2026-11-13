"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { currentAcademicYear } from "@/domain/academic-year";
import { freezeExpected, MAX_TESTS, runTest } from "@/domain/agsyntax/testing";
import { traceAlgorithm } from "@/domain/agsyntax/trace";
import type { SubmissionView } from "@/features/training/server/actions";
import { exerciseIdSchema, exerciseSchema, submissionSchema } from "@/features/training/schemas";
import { parseExercisesText } from "@/features/training/text";
import type { ActionState } from "@/lib/action-state";
import { paths, ROUTES } from "@/lib/routes";
import { actionError } from "@/server/actions/result";
import { audit } from "@/server/audit";
import { requireTenant } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import {
  groups,
  homeworkGroups,
  homeworkHandins,
  homeworkHintViews,
  homeworkSteps,
  homeworkSubmissions,
  homeworks,
  type AlgoTestResult,
} from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import { groupScope, viewerOf } from "@/server/scope";
import { assertCurrentYear } from "@/server/year";
import { homeworkIdSchema, homeworkSchema, homeworkUpdateSchema } from "../schemas";
import { getStudentHomework, getStudentStep, lastPassingCode } from "./queries";

type State = ActionState<unknown>;
const STAFF = ["FORMATEUR", "ADMIN"] as const;

/** Devoir modifiable : même établissement, année courante, et (formateur) son auteur. */
async function editableHomework(
  homeworkId: string,
  user: { id: string; role: string; establishmentId: string },
) {
  const viewer = viewerOf(user);
  const [row] = await getDb()
    .select({ id: homeworks.id, title: homeworks.title, academicYear: homeworks.academicYear })
    .from(homeworks)
    .where(
      and(
        eq(homeworks.id, homeworkId),
        eq(homeworks.establishmentId, user.establishmentId),
        viewer
          ? sql`(${homeworks.authorId} = ${viewer} or ${homeworks.authorId} is null)`
          : undefined,
      ),
    )
    .limit(1);
  if (!row) throw errors.notFound("Devoir introuvable.");
  assertCurrentYear(row.academicYear, "Ce devoir");
  return row;
}

export async function createHomeworkAction(_prev: State, formData: FormData): Promise<State> {
  let homeworkId: string;
  try {
    const user = await requireTenant(...STAFF);
    const input = homeworkSchema.parse(Object.fromEntries(formData));
    const [row] = await getDb()
      .insert(homeworks)
      .values({ ...input, establishmentId: user.establishmentId, authorId: user.id })
      .returning({ id: homeworks.id });
    homeworkId = row!.id;
    revalidatePath(ROUTES.trainer.homework);
  } catch (error) {
    return actionError(error);
  }
  redirect(paths.homework(homeworkId));
}

export async function updateHomeworkAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant(...STAFF);
    const input = homeworkUpdateSchema.parse({
      homeworkId: formData.get("homeworkId"),
      title: formData.get("title") ?? "",
      sessionLabel: formData.get("sessionLabel") ?? "",
      description: formData.get("description") ?? "",
      dueAt: formData.get("dueAt") ?? "",
      isPublished: formData.get("isPublished") === "on",
      groupIds: formData.getAll("groupId"),
    });
    await editableHomework(input.homeworkId, user);
    const db = getDb();
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
      const count = await db.$count(homeworkSteps, eq(homeworkSteps.homeworkId, input.homeworkId));
      if (count === 0) throw errors.badRequest("Ajoutez au moins une étape avant de publier.");
    }
    await db.transaction(async (tx) => {
      await tx
        .update(homeworks)
        .set({
          title: input.title,
          sessionLabel: input.sessionLabel,
          description: input.description,
          dueAt: input.dueAt,
          isPublished: input.isPublished,
          updatedAt: new Date(),
        })
        .where(eq(homeworks.id, input.homeworkId));
      await tx.delete(homeworkGroups).where(eq(homeworkGroups.homeworkId, input.homeworkId));
      if (valid.length) {
        await tx
          .insert(homeworkGroups)
          .values(valid.map((g) => ({ homeworkId: input.homeworkId, groupId: g.id })));
      }
    });
    revalidatePath(paths.homework(input.homeworkId));
    revalidatePath(ROUTES.trainer.homework);
    return { status: "success", message: "Devoir enregistré." };
  } catch (error) {
    return actionError(error);
  }
}

/** Publication en un clic (bandeau du devoir) : exige au moins une étape et un groupe. */
export async function setHomeworkPublishedAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant(...STAFF);
    const { homeworkId } = homeworkIdSchema.parse({ homeworkId: formData.get("homeworkId") });
    const publish = formData.get("publish") === "1";
    await editableHomework(homeworkId, user);
    const db = getDb();
    if (publish) {
      const [steps, groupCount] = await Promise.all([
        db.$count(homeworkSteps, eq(homeworkSteps.homeworkId, homeworkId)),
        db.$count(homeworkGroups, eq(homeworkGroups.homeworkId, homeworkId)),
      ]);
      if (steps === 0) throw errors.badRequest("Ajoutez au moins une étape avant de publier.");
      if (groupCount === 0) {
        throw errors.badRequest("Choisissez un groupe dans les Réglages puis Enregistrer.");
      }
    }
    await db
      .update(homeworks)
      .set({ isPublished: publish, updatedAt: new Date() })
      .where(eq(homeworks.id, homeworkId));
    revalidatePath(paths.homework(homeworkId));
    revalidatePath(ROUTES.trainer.homework);
    return {
      status: "success",
      message: publish
        ? "Devoir publié : les stagiaires le voient."
        : "Devoir repassé en brouillon.",
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteHomeworkAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant(...STAFF);
    const { homeworkId } = homeworkIdSchema.parse(Object.fromEntries(formData));
    const hw = await editableHomework(homeworkId, user);
    await getDb().transaction(async (tx) => {
      await tx.delete(homeworks).where(eq(homeworks.id, homeworkId));
      await audit(tx, {
        actorId: user.id,
        action: "homework.delete",
        entityType: "homework",
        entityId: homeworkId,
        payload: { title: hw.title },
      });
    });
  } catch (error) {
    return actionError(error);
  }
  revalidatePath(ROUTES.trainer.homework);
  redirect(ROUTES.trainer.homework);
}

/**
 * Enregistre une étape (même éditeur que l'entraînement : `trackId` = devoir,
 * `level` = numéro d'étape). Le corrigé fige les sorties attendues.
 */
export async function saveHomeworkStepAction(_prev: State, formData: FormData): Promise<State> {
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
    const homeworkId = input.trackId;
    await editableHomework(homeworkId, user);
    if (input.hintCode.trim()) {
      const t = traceAlgorithm(input.hintCode, input.hintInputs ?? [], 50);
      if (t.error && t.frames.length === 0) {
        throw errors.badRequest(
          `Code de l'indice invalide${t.error.line ? ` (ligne ${t.error.line})` : ""} : ${t.error.message}`,
        );
      }
    }
    const frozen = freezeExpected(input.solutionCode, input.tests.slice(0, MAX_TESTS));
    if (!frozen.ok) {
      const where = frozen.error.line ? ` (ligne ${frozen.error.line})` : "";
      throw errors.badRequest(
        `Le corrigé échoue sur le jeu d'essai ${frozen.index + 1}${where} : ${frozen.error.message}`,
      );
    }
    const db = getDb();
    const values = {
      stepNo: input.level,
      title: input.title,
      statement: input.statement,
      starterCode: input.starterCode,
      solutionCode: input.solutionCode,
      tests: frozen.tests,
      hintCode: input.hintCode.trim() ? input.hintCode : "",
      hintInputs: input.hintInputs,
      updatedAt: new Date(),
    };
    let stepId = input.exerciseId;
    if (stepId) {
      const updated = await db
        .update(homeworkSteps)
        .set(values)
        .where(and(eq(homeworkSteps.id, stepId), eq(homeworkSteps.homeworkId, homeworkId)))
        .returning({ id: homeworkSteps.id });
      if (updated.length === 0) throw errors.notFound("Étape introuvable.");
    } else {
      const [row] = await db
        .insert(homeworkSteps)
        .values({ ...values, homeworkId })
        .returning({ id: homeworkSteps.id });
      stepId = row!.id;
    }
    revalidatePath(paths.homework(homeworkId));
    target = paths.homeworkStep(homeworkId, stepId);
    if (input.exerciseId) {
      revalidatePath(target);
      return { status: "success", message: "Étape enregistrée, sorties attendues figées." };
    }
  } catch (error) {
    return actionError(error);
  }
  redirect(`${target}?cree=1` as Route);
}

export async function deleteHomeworkStepAction(_prev: State, formData: FormData): Promise<State> {
  let homeworkId: string;
  try {
    const user = await requireTenant(...STAFF);
    const { exerciseId: stepId } = exerciseIdSchema.parse(Object.fromEntries(formData));
    const [row] = await getDb()
      .select({ homeworkId: homeworkSteps.homeworkId, title: homeworkSteps.title })
      .from(homeworkSteps)
      .where(eq(homeworkSteps.id, stepId))
      .limit(1);
    if (!row) throw errors.notFound("Étape introuvable.");
    await editableHomework(row.homeworkId, user);
    homeworkId = row.homeworkId;
    await getDb().delete(homeworkSteps).where(eq(homeworkSteps.id, stepId));
  } catch (error) {
    return actionError(error);
  }
  revalidatePath(paths.homework(homeworkId));
  redirect(paths.homework(homeworkId));
}

/**
 * Import de toutes les étapes d'un coup (même format que l'entraînement, « ETAPE: titre »).
 * Numérotées dans l'ordre du texte, à la suite des étapes existantes. Tout ou rien.
 */
export async function importHomeworkStepsAction(_prev: State, formData: FormData): Promise<State> {
  let homeworkId: string;
  try {
    const user = await requireTenant(...STAFF);
    homeworkId = homeworkIdSchema.parse({ homeworkId: formData.get("trackId") }).homeworkId;
    await editableHomework(homeworkId, user);
    const { exercises, globalErrors } = parseExercisesText(String(formData.get("text") ?? ""));
    if (globalErrors.length) throw errors.badRequest(globalErrors[0]!);
    if (exercises.length === 0) throw errors.badRequest("Aucune étape trouvée.");
    const bad = exercises.find((e) => e.errors.length);
    if (bad) throw errors.badRequest(`Étape ${bad.number} (« ${bad.title} ») : ${bad.errors[0]}`);
    const rows = exercises.map((e) => {
      const frozen = freezeExpected(e.solutionCode, e.tests);
      if (!frozen.ok) {
        throw errors.badRequest(
          `Étape ${e.number} (« ${e.title} ») : le corrigé échoue sur le jeu ${frozen.index + 1}${
            frozen.error.line ? ` (ligne ${frozen.error.line})` : ""
          } : ${frozen.error.message}`,
        );
      }
      return { e, tests: frozen.tests };
    });
    await getDb().transaction(async (tx) => {
      const [{ last }] = (await tx.execute(sql`
        select coalesce(max(step_no), 0)::int as last from homework_steps
        where homework_id = ${homeworkId}
      `)) as unknown as [{ last: number }];
      await tx.insert(homeworkSteps).values(
        rows.map(({ e, tests }, i) => ({
          homeworkId,
          stepNo: last + i + 1,
          title: e.title,
          statement: e.statement,
          starterCode: e.starterCode,
          solutionCode: e.solutionCode,
          tests,
          hintCode: e.hintCode,
          hintInputs: e.hintInputs,
        })),
      );
    });
    revalidatePath(paths.homework(homeworkId));
  } catch (error) {
    return actionError(error);
  }
  redirect(`${paths.homework(homeworkId)}?importes=1` as Route);
}

// ── Stagiaire ────────────────────────────────────────────────────────────

/** Soumission d'une étape : tous les jeux d'essai sont exécutés côté serveur. */
export async function submitHomeworkStepAction(
  _prev: ActionState<SubmissionView>,
  formData: FormData,
): Promise<ActionState<SubmissionView>> {
  try {
    const user = await requireTenant("ETUDIANT");
    const input = submissionSchema.parse(Object.fromEntries(formData));
    const stepId = input.exerciseId;
    // Contrôle d'accès + étape ouverte (lève une erreur sinon).
    const view = await getStudentStep(user.id, user.establishmentId, stepId);
    const [step] = await getDb()
      .select({ tests: homeworkSteps.tests })
      .from(homeworkSteps)
      .where(eq(homeworkSteps.id, stepId))
      .limit(1);
    if (!step) throw errors.notFound("Étape introuvable.");
    const results: AlgoTestResult[] = step.tests.map((t) => {
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
    await getDb().insert(homeworkSubmissions).values({
      stepId,
      studentId: user.id,
      code: input.code,
      passed,
      passedCount,
      totalCount: results.length,
      results,
    });
    revalidatePath(paths.studentHomework(view.homework.id));
    revalidatePath(ROUTES.student.homework);
    return {
      status: "success",
      data: {
        passed,
        passedCount,
        totalCount: results.length,
        results,
        justUnlocked: passed && !view.passed && !!view.next,
        xpGained: 0,
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

/** Indice consulté (le stagiaire a fait défiler l'animation) : compté pour le formateur. */
export async function recordHintViewAction(stepId: string): Promise<ActionState<null>> {
  try {
    const user = await requireTenant("ETUDIANT");
    exerciseIdSchema.parse({ exerciseId: stepId });
    await getStudentStep(user.id, user.establishmentId, stepId);
    await getDb()
      .insert(homeworkHintViews)
      .values({ stepId, studentId: user.id })
      .onConflictDoUpdate({
        target: [homeworkHintViews.stepId, homeworkHintViews.studentId],
        set: { views: sql`${homeworkHintViews.views} + 1`, lastAt: new Date() },
      });
    return { status: "success", data: null };
  } catch (error) {
    return actionError(error);
  }
}

/** Rendu final : l'algorithme complet (dernière étape réussie) et sa trace. Aucune note. */
export async function handInHomeworkAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant("ETUDIANT");
    const { homeworkId } = homeworkIdSchema.parse(Object.fromEntries(formData));
    const view = await getStudentHomework(user.id, user.establishmentId, homeworkId);
    if (!view.allPassed) throw errors.badRequest("Réussissez toutes les étapes avant de rendre.");
    const lastStep = view.steps[view.steps.length - 1]!;
    const code = await lastPassingCode(user.id, lastStep.id);
    if (!code) throw errors.badRequest("Réussissez la dernière étape avant de rendre.");
    const [step] = await getDb()
      .select({ tests: homeworkSteps.tests })
      .from(homeworkSteps)
      .where(eq(homeworkSteps.id, lastStep.id))
      .limit(1);
    const example = step?.tests.find((t) => !t.hidden) ?? step?.tests[0];
    const trace = traceAlgorithm(code, example?.inputs ?? [], 300);
    const now = new Date();
    const isLate = !!view.homework.dueAt && now > view.homework.dueAt;
    await getDb()
      .insert(homeworkHandins)
      .values({
        homeworkId,
        studentId: user.id,
        code,
        trace: trace.frames,
        isLate,
        submittedAt: now,
      })
      .onConflictDoUpdate({
        target: [homeworkHandins.homeworkId, homeworkHandins.studentId],
        set: { code, trace: trace.frames, isLate, submittedAt: now },
      });
    revalidatePath(paths.studentHomework(homeworkId));
    revalidatePath(ROUTES.student.homework);
    return { status: "success", message: "Devoir rendu." };
  } catch (error) {
    return actionError(error);
  }
}
