"use server";

import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { actionError } from "@/server/actions/result";
import { requireTenant } from "@/server/auth/session";
import { addTime, answerHelp, broadcastMessage, cancelSanction, extendExam } from "./service";

const STAFF = ["FORMATEUR", "ADMIN"] as const;
type State = ActionState<unknown>;

export async function cancelSanctionAction(incidentId: string): Promise<State> {
  try {
    const staff = await requireTenant(...STAFF);
    const { reopened } = await cancelSanction(staff, z.uuid().parse(incidentId));
    return {
      status: "success",
      message: reopened
        ? "Sanction annulée : l'étudiant peut reprendre l'examen."
        : "Sanction annulée.",
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function addTimeAction(attemptId: string, seconds: number): Promise<State> {
  try {
    const staff = await requireTenant(...STAFF);
    await addTime(staff, z.uuid().parse(attemptId), z.number().int().parse(seconds));
    return {
      status: "success",
      message: `+${seconds >= 60 ? `${seconds / 60} min` : `${seconds} s`} ajoutées.`,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function broadcastAction(examId: string, message: string): Promise<State> {
  try {
    const staff = await requireTenant(...STAFF);
    const text = z.string().max(280, "280 caractères maximum.").parse(message);
    await broadcastMessage(staff, z.uuid().parse(examId), text);
    return { status: "success", message: text.trim() ? "Message envoyé." : "Message effacé." };
  } catch (error) {
    if (error instanceof z.ZodError) return { status: "error", message: error.issues[0]!.message };
    return actionError(error);
  }
}

export async function extendExamAction(examId: string, minutes: number): Promise<State> {
  try {
    const staff = await requireTenant(...STAFF);
    const m = z.number().int().min(5).max(120).parse(minutes);
    await extendExam(staff, z.uuid().parse(examId), m);
    return { status: "success", message: `Fermeture repoussée de ${m} min.` };
  } catch (error) {
    return actionError(error);
  }
}

export async function answerHelpAction(helpId: string, answer: string): Promise<State> {
  try {
    const staff = await requireTenant(...STAFF);
    await answerHelp(
      staff,
      z.uuid().parse(helpId),
      z.string().trim().min(1).max(500).parse(answer),
    );
    return { status: "success", message: "Réponse envoyée à l'étudiant." };
  } catch (error) {
    return actionError(error);
  }
}
