"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { paths, ROUTES } from "@/lib/routes";
import { actionError } from "@/server/actions/result";
import { requireTenant } from "@/server/auth/session";
import { errors } from "@/server/http/errors";
import { examIdSchema, saveExamSchema } from "../schemas";
import { toEditorInitial } from "./editor-data";
import { getExamDetail } from "./queries";
import { convertQuestionFile, type ConvertedFile } from "./question-files";
import {
  closeExamNow,
  deleteExam,
  duplicateExam,
  openExamNow,
  regenerateAccessCode,
  saveExam,
  unpublishExam,
} from "./service";

const STAFF = ["FORMATEUR", "ADMIN"] as const;
type State = ActionState<unknown>;

function examIdFrom(formData: FormData): string {
  return examIdSchema.parse({ examId: formData.get("examId") }).examId;
}

export async function saveExamAction(_prev: State, formData: FormData): Promise<State> {
  let target: Route;
  try {
    const actor = await requireTenant(...STAFF);
    let settings: unknown;
    try {
      settings = JSON.parse(String(formData.get("settings") ?? "{}"));
    } catch {
      throw errors.badRequest("Réglages invalides.");
    }
    const input = saveExamSchema.parse({
      examId: formData.get("examId") ?? "",
      intent: formData.get("intent"),
      title: formData.get("title") ?? "",
      description: formData.get("description") ?? "",
      moduleId: formData.get("moduleId") ?? "",
      groupIds: formData.getAll("groupId"),
      opensAt: formData.get("opensAt") ?? "",
      closesAt: formData.get("closesAt") ?? "",
      sourceText: formData.get("sourceText") ?? "",
      settings,
    });
    const { examId } = await saveExam(actor, input);
    revalidatePath(ROUTES.trainer.exams);
    revalidatePath(paths.exam(examId));
    target = paths.exam(examId);
  } catch (error) {
    return actionError(error);
  }
  redirect(target);
}

/** Publie un brouillon tel qu'il est enregistré (bouton « Publier » de la fiche examen). */
export async function publishExamAction(_prev: State, formData: FormData): Promise<State> {
  let target: Route;
  try {
    const actor = await requireTenant(...STAFF);
    const exam = await getExamDetail(actor, examIdFrom(formData));
    if (!exam) throw errors.notFound("Examen introuvable.");
    const v = toEditorInitial(exam);
    const { examId } = await saveExam(actor, {
      examId: v.id,
      intent: "publish",
      title: v.title,
      description: v.description,
      moduleId: v.moduleId ?? "",
      groupIds: v.groupIds,
      opensAt: exam.opensAt,
      closesAt: exam.closesAt,
      sourceText: v.sourceText,
      settings: v.settings,
    });
    revalidatePath(ROUTES.trainer.exams);
    revalidatePath(paths.exam(examId));
    target = paths.exam(examId);
  } catch (error) {
    return actionError(error);
  }
  redirect(target);
}

/** Conversion d'un fichier (.txt / .xlsx) en texte, inséré ensuite dans l'éditeur. */
export async function convertQuestionFileAction(
  _prev: ActionState<ConvertedFile>,
  formData: FormData,
): Promise<ActionState<ConvertedFile>> {
  try {
    await requireTenant(...STAFF);
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0)
      throw errors.badRequest("Choisissez un fichier.");
    return { status: "success", data: await convertQuestionFile(file) };
  } catch (error) {
    return actionError(error);
  }
}

export async function duplicateExamAction(_prev: State, formData: FormData): Promise<State> {
  let newId: string;
  try {
    const actor = await requireTenant(...STAFF);
    newId = await duplicateExam(actor, examIdFrom(formData));
    revalidatePath(ROUTES.trainer.exams);
  } catch (error) {
    return actionError(error);
  }
  redirect(paths.editExam(newId));
}

export async function deleteExamAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const actor = await requireTenant(...STAFF);
    await deleteExam(actor, examIdFrom(formData));
    revalidatePath(ROUTES.trainer.exams);
  } catch (error) {
    return actionError(error);
  }
  redirect(ROUTES.trainer.exams);
}

export async function unpublishExamAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const actor = await requireTenant(...STAFF);
    const examId = examIdFrom(formData);
    await unpublishExam(actor, examId);
    revalidatePath(paths.exam(examId));
    return { status: "success", message: "Examen repassé en brouillon." };
  } catch (error) {
    return actionError(error);
  }
}

export async function openExamNowAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const actor = await requireTenant(...STAFF);
    const examId = examIdFrom(formData);
    await openExamNow(actor, examId);
    revalidatePath(paths.exam(examId));
    return { status: "success", message: "Examen ouvert." };
  } catch (error) {
    return actionError(error);
  }
}

export async function closeExamNowAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const actor = await requireTenant(...STAFF);
    const examId = examIdFrom(formData);
    await closeExamNow(actor, examId);
    revalidatePath(paths.exam(examId));
    return { status: "success", message: "Examen fermé." };
  } catch (error) {
    return actionError(error);
  }
}

export async function regenerateCodeAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const actor = await requireTenant(...STAFF);
    const examId = examIdFrom(formData);
    await regenerateAccessCode(actor, examId);
    revalidatePath(paths.exam(examId));
    return { status: "success", message: "Nouveau code généré." };
  } catch (error) {
    return actionError(error);
  }
}
