"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DIFFICULTIES } from "@/domain/enums";
import type { ActionState } from "@/lib/action-state";
import { paths, ROUTES } from "@/lib/routes";
import { actionError } from "@/server/actions/result";
import { requireTenant } from "@/server/auth/session";
import { setQuestionArchived, updateQuestionMeta } from "./service";

const STAFF = ["FORMATEUR", "ADMIN"] as const;
type State = ActionState<unknown>;

const metaSchema = z.object({
  difficulty: z.enum(DIFFICULTIES),
  chapterId: z.uuid().nullable(),
});

export async function updateQuestionMetaAction(
  questionId: string,
  input: z.input<typeof metaSchema>,
): Promise<State> {
  try {
    const staff = await requireTenant(...STAFF);
    const id = z.uuid().parse(questionId);
    await updateQuestionMeta(staff, id, metaSchema.parse(input));
    revalidatePath(paths.bankQuestion(id));
    revalidatePath(ROUTES.trainer.bank);
    return { status: "success", message: "Classement enregistré." };
  } catch (error) {
    return actionError(error);
  }
}

export async function archiveQuestionAction(questionId: string, archived: boolean): Promise<State> {
  try {
    const staff = await requireTenant(...STAFF);
    const id = z.uuid().parse(questionId);
    await setQuestionArchived(staff, id, z.boolean().parse(archived));
    revalidatePath(paths.bankQuestion(id));
    revalidatePath(ROUTES.trainer.bank);
    return {
      status: "success",
      message: archived
        ? "Question archivée : elle n'est plus proposée."
        : "Question restaurée dans la banque.",
    };
  } catch (error) {
    return actionError(error);
  }
}
