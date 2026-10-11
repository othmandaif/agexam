"use server";

import { and, eq, inArray, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { paths, ROUTES } from "@/lib/routes";
import { slugify } from "@/lib/text";
import { actionError } from "@/server/actions/result";
import { audit } from "@/server/audit";
import { requireRole, requireTenant } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { chapters, establishments, modules, profiles } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import {
  chapterSchema,
  chapterUpdateSchema,
  establishmentSchema,
  idSchema,
  moduleSchema,
  moduleUpdateSchema,
} from "../schemas";

type State = ActionState<unknown>;

const form = (formData: FormData) => Object.fromEntries(formData);

/** Première configuration : crée l'établissement et y rattache l'administrateur. */
export async function createEstablishmentAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireRole("ADMIN");
    if (user.establishmentId)
      throw errors.conflict("Votre compte est déjà rattaché à un établissement.");
    const { name } = establishmentSchema.parse(form(formData));
    const slug = `${slugify(name) || "etablissement"}-${crypto.randomUUID().slice(0, 6)}`;

    await getDb().transaction(async (tx) => {
      const [created] = await tx
        .insert(establishments)
        .values({ name, slug })
        .returning({ id: establishments.id });
      await tx
        .update(profiles)
        .set({ establishmentId: created!.id })
        .where(eq(profiles.id, user.id));
      await audit(tx, {
        actorId: user.id,
        action: "establishment.create",
        entityType: "establishment",
        entityId: created!.id,
        payload: { name },
      });
    });
  } catch (error) {
    return actionError(error);
  }
  redirect(ROUTES.admin.referential);
}

export async function updateEstablishmentAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant("ADMIN");
    const { name } = establishmentSchema.parse(form(formData));
    await getDb()
      .update(establishments)
      .set({ name })
      .where(eq(establishments.id, user.establishmentId));
    revalidatePath(ROUTES.admin.referential);
    return { status: "success", message: "Nom de l'établissement enregistré." };
  } catch (error) {
    return actionError(error);
  }
}

export async function createModuleAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant("ADMIN");
    const input = moduleSchema.parse(form(formData));
    await getDb()
      .insert(modules)
      .values({ ...input, establishmentId: user.establishmentId });
    revalidatePath(ROUTES.admin.referential);
    return { status: "success", message: `Module ${input.code} créé.` };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateModuleAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant("ADMIN");
    const { moduleId, ...input } = moduleUpdateSchema.parse(form(formData));
    const updated = await getDb()
      .update(modules)
      .set(input)
      .where(and(eq(modules.id, moduleId), eq(modules.establishmentId, user.establishmentId)))
      .returning({ id: modules.id });
    if (updated.length === 0) throw errors.notFound("Module introuvable.");
    revalidatePath(paths.module(moduleId));
    return { status: "success", message: "Module enregistré." };
  } catch (error) {
    return actionError(error);
  }
}

/** Refusée si des questions utilisent encore le module (contrainte RESTRICT). */
export async function deleteModuleAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant("ADMIN");
    const { moduleId } = idSchema("moduleId").parse(form(formData)) as { moduleId: string };
    const deleted = await getDb()
      .delete(modules)
      .where(and(eq(modules.id, moduleId), eq(modules.establishmentId, user.establishmentId)))
      .returning({ id: modules.id, code: modules.code });
    if (deleted.length === 0) throw errors.notFound("Module introuvable.");
    await audit(getDb(), {
      actorId: user.id,
      action: "module.delete",
      entityType: "module",
      entityId: moduleId,
      payload: { code: deleted[0]!.code },
    });
  } catch (error) {
    return actionError(error);
  }
  redirect(ROUTES.admin.referential);
}

/** Vérifie que le module appartient à l'établissement de l'utilisateur. */
async function assertModuleInTenant(moduleId: string, establishmentId: string) {
  const [row] = await getDb()
    .select({ id: modules.id })
    .from(modules)
    .where(and(eq(modules.id, moduleId), eq(modules.establishmentId, establishmentId)))
    .limit(1);
  if (!row) throw errors.notFound("Module introuvable.");
}

/** Identifiants des modules de l'établissement (pour filtrer les chapitres). */
function modulesOfTenant(establishmentId: string) {
  return getDb()
    .select({ id: modules.id })
    .from(modules)
    .where(eq(modules.establishmentId, establishmentId));
}

export async function createChapterAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant("ADMIN");
    const { moduleId, name } = chapterSchema.parse(form(formData));
    await assertModuleInTenant(moduleId, user.establishmentId);
    const db = getDb();
    const [{ last } = { last: null }] = await db
      .select({ last: max(chapters.position) })
      .from(chapters)
      .where(eq(chapters.moduleId, moduleId));
    await db.insert(chapters).values({ moduleId, name, position: (last ?? -1) + 1 });
    revalidatePath(paths.module(moduleId));
    return { status: "success", message: `Chapitre « ${name} » ajouté.` };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateChapterAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant("ADMIN");
    const { chapterId, name } = chapterUpdateSchema.parse(form(formData));
    const updated = await getDb()
      .update(chapters)
      .set({ name })
      .where(
        and(
          eq(chapters.id, chapterId),
          inArray(chapters.moduleId, modulesOfTenant(user.establishmentId)),
        ),
      )
      .returning({ moduleId: chapters.moduleId });
    if (updated.length === 0) throw errors.notFound("Chapitre introuvable.");
    revalidatePath(paths.module(updated[0]!.moduleId));
    return { status: "success", message: "Chapitre renommé." };
  } catch (error) {
    return actionError(error);
  }
}

/** Les questions du chapitre restent dans le module (chapter_id passe à NULL). */
export async function deleteChapterAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant("ADMIN");
    const { chapterId } = idSchema("chapterId").parse(form(formData)) as { chapterId: string };
    const deleted = await getDb()
      .delete(chapters)
      .where(
        and(
          eq(chapters.id, chapterId),
          inArray(chapters.moduleId, modulesOfTenant(user.establishmentId)),
        ),
      )
      .returning({ moduleId: chapters.moduleId });
    if (deleted.length === 0) throw errors.notFound("Chapitre introuvable.");
    revalidatePath(paths.module(deleted[0]!.moduleId));
    return { status: "success" };
  } catch (error) {
    return actionError(error);
  }
}
