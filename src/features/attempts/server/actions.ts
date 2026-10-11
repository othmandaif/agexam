"use server";

import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionError } from "@/server/actions/result";
import { requireTenant } from "@/server/auth/session";
import { errors } from "@/server/http/errors";
import { accessCodeSchema } from "../schemas";
import { startAttempt } from "./engine";
import { findExamByCode } from "./queries";

/** Démarre (ou reprend) la tentative. Le plein écran a déjà été demandé par le navigateur. */
export async function startAttemptAction(
  _prev: ActionState<{ attemptId: string }>,
  formData: FormData,
): Promise<ActionState<{ attemptId: string }>> {
  try {
    const student = await requireTenant("ETUDIANT");
    const examId = z.uuid().parse(formData.get("examId"));
    const resume = formData.get("resume") === "1";
    // Entraînement : pas de code (le moteur vérifie qu'il s'agit bien d'un entraînement).
    const rawCode = formData.get("accessCode");
    const accessCode = resume || !rawCode ? "" : accessCodeSchema.parse(rawCode);
    const userAgent = (await headers()).get("user-agent");
    const result = await startAttempt(student, { examId, accessCode, userAgent });
    return { status: "success", data: { attemptId: result.attemptId } };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { status: "error", message: error.issues[0]?.message ?? "Code invalide." };
    }
    return actionError(error);
  }
}

/** Code saisi sur l'accueil : mène à la page de préparation de l'examen. */
export async function joinByCodeAction(
  _prev: ActionState<unknown>,
  formData: FormData,
): Promise<ActionState<unknown>> {
  let target: Route;
  try {
    const student = await requireTenant("ETUDIANT");
    const parsed = accessCodeSchema.safeParse(formData.get("code") ?? "");
    if (!parsed.success)
      throw errors.badRequest(parsed.error.issues[0]?.message ?? "Code invalide.");
    const exam = await findExamByCode(student, parsed.data);
    if (!exam) throw errors.notFound("Aucun examen ne correspond à ce code pour vos groupes.");
    target = `/etudiant/examens/${exam.id}/preparation?code=${parsed.data}` as Route;
  } catch (error) {
    return actionError(error);
  }
  redirect(target);
}
