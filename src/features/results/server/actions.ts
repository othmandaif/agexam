"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RESULT_RELEASE_MODES, RESULT_VISIBILITIES } from "@/domain/enums";
import type { ActionState } from "@/lib/action-state";
import { paths } from "@/lib/routes";
import { actionError } from "@/server/actions/result";
import { requireTenant } from "@/server/auth/session";
import {
  allowRetake,
  correctAnswerKey,
  setAttemptReviewed,
  setQuestionNeutralized,
  setClassBonus,
  setResultsPublished,
  updateResultSettings,
} from "./service";

const STAFF = ["FORMATEUR", "ADMIN"] as const;
type State = ActionState<unknown>;
const uuid = z.uuid();

const plural = (n: number) => `${n} copie${n > 1 ? "s" : ""} recalculée${n > 1 ? "s" : ""}`;

function refresh(examId: string, attemptId?: string) {
  revalidatePath(paths.examResults(examId));
  if (attemptId) revalidatePath(paths.examCopy(examId, attemptId));
}

export async function neutralizeQuestionAction(
  examId: string,
  examQuestionId: string,
  neutralized: boolean,
): Promise<State> {
  try {
    const staff = await requireTenant(...STAFF);
    const { rescored } = await setQuestionNeutralized(
      staff,
      uuid.parse(examId),
      uuid.parse(examQuestionId),
      z.boolean().parse(neutralized),
    );
    refresh(examId);
    return {
      status: "success",
      message: `${neutralized ? "Question neutralisée" : "Question de nouveau comptée"} · ${plural(rescored)}.`,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function correctKeyAction(
  examId: string,
  examQuestionId: string,
  correctOptionIds: string[],
): Promise<State> {
  try {
    const staff = await requireTenant(...STAFF);
    const { rescored } = await correctAnswerKey(
      staff,
      uuid.parse(examId),
      uuid.parse(examQuestionId),
      z.array(z.string().min(1).max(36)).max(10).parse(correctOptionIds),
    );
    refresh(examId);
    return { status: "success", message: `Bonne réponse corrigée · ${plural(rescored)}.` };
  } catch (error) {
    return actionError(error);
  }
}

/** Bonus de classe : 0 à 10 points sur 20, par pas de 0,25. */
export async function classBonusAction(examId: string, bonusPoints: number): Promise<State> {
  try {
    const staff = await requireTenant(...STAFF);
    const bonus = z
      .number()
      .min(0, "Le bonus ne peut pas être négatif.")
      .max(10, "10 points maximum.")
      .multipleOf(0.25, "Par pas de 0,25 point.")
      .parse(bonusPoints);
    const { rescored } = await setClassBonus(staff, uuid.parse(examId), bonus);
    refresh(examId);
    return {
      status: "success",
      message:
        bonus > 0
          ? `Bonus de +${String(bonus).replace(".", ",")} appliqué à ${rescored} copie${rescored > 1 ? "s" : ""}.`
          : "Bonus retiré.",
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function publishResultsAction(examId: string, published: boolean): Promise<State> {
  try {
    const staff = await requireTenant(...STAFF);
    await setResultsPublished(staff, uuid.parse(examId), z.boolean().parse(published));
    refresh(examId);
    return {
      status: "success",
      message: published ? "Notes envoyées aux étudiants." : "Notes retirées.",
    };
  } catch (error) {
    return actionError(error);
  }
}

const settingsSchema = z.object({
  visibility: z.enum(RESULT_VISIBILITIES),
  releaseMode: z.enum(RESULT_RELEASE_MODES),
});

export async function resultSettingsAction(
  examId: string,
  input: z.input<typeof settingsSchema>,
): Promise<State> {
  try {
    const staff = await requireTenant(...STAFF);
    await updateResultSettings(staff, uuid.parse(examId), settingsSchema.parse(input));
    refresh(examId);
    return { status: "success", message: "Réglages de diffusion enregistrés." };
  } catch (error) {
    return actionError(error);
  }
}

export async function reviewAttemptAction(attemptId: string, reviewed: boolean): Promise<State> {
  try {
    const staff = await requireTenant(...STAFF);
    const attempt = await setAttemptReviewed(
      staff,
      uuid.parse(attemptId),
      z.boolean().parse(reviewed),
    );
    refresh(attempt.examId, attempt.id);
    return {
      status: "success",
      message: reviewed ? "Copie marquée comme vérifiée." : "Copie signalée à revoir.",
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function allowRetakeAction(attemptId: string): Promise<State> {
  try {
    const staff = await requireTenant(...STAFF);
    const attempt = await allowRetake(staff, uuid.parse(attemptId));
    refresh(attempt.examId, attempt.id);
    return {
      status: "success",
      message: "Copie annulée : l'étudiant peut repasser l'examen tant qu'il est ouvert.",
    };
  } catch (error) {
    return actionError(error);
  }
}
