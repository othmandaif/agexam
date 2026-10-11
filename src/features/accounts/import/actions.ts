"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/lib/action-state";
import { ROUTES } from "@/lib/routes";
import { actionError } from "@/server/actions/result";
import { requireTenant } from "@/server/auth/session";
import { errors } from "@/server/http/errors";
import { MAX_IMPORT_ROWS } from "./parse";
import { previewImport, runImport, type ImportPreview, type ImportResult } from "./server";

export async function previewImportAction(
  _prev: ActionState<ImportPreview>,
  formData: FormData,
): Promise<ActionState<ImportPreview>> {
  try {
    const actor = await requireTenant("ADMIN", "FORMATEUR");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      throw errors.badRequest("Choisissez un fichier .xlsx ou .csv.");
    }
    const groupId = z
      .uuid()
      .nullable()
      .catch(null)
      .parse(formData.get("groupId") || null);
    return { status: "success", data: await previewImport(actor, file, groupId) };
  } catch (error) {
    return actionError(error);
  }
}

const submittedRowsSchema = z
  .array(
    z.object({
      line: z.number().int().positive(),
      fullName: z.string().max(200),
      email: z.string().max(320),
      groupName: z.string().max(80).nullable(),
      errors: z.array(z.string()).default([]),
    }),
  )
  .min(1)
  .max(MAX_IMPORT_ROWS);

export async function runImportAction(
  _prev: ActionState<ImportResult>,
  formData: FormData,
): Promise<ActionState<ImportResult>> {
  try {
    const actor = await requireTenant("ADMIN", "FORMATEUR");
    let payload: unknown;
    try {
      payload = JSON.parse(String(formData.get("rows") ?? "[]"));
    } catch {
      throw errors.badRequest("Données d'import invalides. Recommencez l'import.");
    }
    const rows = submittedRowsSchema.parse(payload);
    const groupId = z
      .uuid()
      .nullable()
      .catch(null)
      .parse(formData.get("groupId") || null);
    const result = await runImport(actor, rows, groupId);
    revalidatePath(ROUTES.admin.accounts);
    revalidatePath(ROUTES.trainer.groups);
    revalidatePath(ROUTES.trainer.students);
    return { status: "success", data: result };
  } catch (error) {
    return actionError(error);
  }
}
