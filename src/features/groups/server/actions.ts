"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { paths, ROUTES } from "@/lib/routes";
import { actionError } from "@/server/actions/result";
import { audit } from "@/server/audit";
import { requireTenant } from "@/server/auth/session";
import { groupScope, studentScope, viewerOf } from "@/server/scope";
import { assertCurrentYear } from "@/server/year";
import { getDb } from "@/server/db/client";
import { examGroups, groupMembers, groups, profiles } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import {
  groupIdSchema,
  groupSchema,
  groupUpdateSchema,
  memberSchema,
  membersSchema,
} from "../schemas";

type State = ActionState<unknown>;

const STAFF = ["FORMATEUR", "ADMIN"] as const;

/** Groupe de l'établissement, modifiable seulement s'il est de l'année courante. */
async function assertGroupInTenant(
  groupId: string,
  establishmentId: string,
  viewerId: string | null,
) {
  const [row] = await getDb()
    .select({ id: groups.id, name: groups.name, academicYear: groups.academicYear })
    .from(groups)
    .where(
      and(
        eq(groups.id, groupId),
        eq(groups.establishmentId, establishmentId),
        groupScope(viewerId),
      ),
    )
    .limit(1);
  if (!row) throw errors.notFound("Groupe introuvable.");
  assertCurrentYear(row.academicYear, "Ce groupe");
  return row;
}

export async function createGroupAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant("FORMATEUR");
    const input = groupSchema.parse(Object.fromEntries(formData));
    await getDb()
      .insert(groups)
      .values({ ...input, establishmentId: user.establishmentId, ownerId: user.id });
    revalidatePath(ROUTES.trainer.groups);
    return { status: "success", message: `Groupe ${input.name} créé.` };
  } catch (error) {
    return actionError(error);
  }
}

export async function updateGroupAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant("FORMATEUR");
    const { groupId, ...input } = groupUpdateSchema.parse(Object.fromEntries(formData));
    await assertGroupInTenant(groupId, user.establishmentId, viewerOf(user));
    const updated = await getDb()
      .update(groups)
      .set(input)
      .where(and(eq(groups.id, groupId), eq(groups.establishmentId, user.establishmentId)))
      .returning({ id: groups.id });
    if (updated.length === 0) throw errors.notFound("Groupe introuvable.");
    revalidatePath(paths.group(groupId));
    return { status: "success", message: "Groupe enregistré." };
  } catch (error) {
    return actionError(error);
  }
}

/** Refusée si le groupe est affecté à un examen : les étudiants perdraient l'accès sans prévenir. */
export async function deleteGroupAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant("FORMATEUR");
    const { groupId } = groupIdSchema.parse(Object.fromEntries(formData));
    const group = await assertGroupInTenant(groupId, user.establishmentId, viewerOf(user));
    const db = getDb();
    const examCount = await db.$count(examGroups, eq(examGroups.groupId, groupId));
    if (examCount > 0) {
      throw errors.conflict(
        `Ce groupe est affecté à ${examCount} examen${examCount > 1 ? "s" : ""}. Retirez-le d'abord des examens.`,
      );
    }
    await db.transaction(async (tx) => {
      await tx.delete(groups).where(eq(groups.id, groupId));
      await audit(tx, {
        actorId: user.id,
        action: "group.delete",
        entityType: "group",
        entityId: groupId,
        payload: { name: group.name },
      });
    });
  } catch (error) {
    return actionError(error);
  }
  redirect(ROUTES.trainer.groups);
}

export async function addMembersAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant(...STAFF);
    const { groupId, profileIds } = membersSchema.parse({
      groupId: formData.get("groupId"),
      profileIds: formData.getAll("profileId"),
    });
    await assertGroupInTenant(groupId, user.establishmentId, viewerOf(user));

    const db = getDb();
    // Seuls les étudiants du même établissement peuvent être ajoutés.
    const students = await db
      .select({ id: profiles.id })
      .from(profiles)
      .where(
        and(
          inArray(profiles.id, profileIds),
          eq(profiles.establishmentId, user.establishmentId),
          eq(profiles.role, "ETUDIANT"),
          studentScope(viewerOf(user), "profiles"),
        ),
      );
    if (students.length === 0) throw errors.badRequest("Aucun étudiant valide sélectionné.");

    await db
      .insert(groupMembers)
      .values(students.map((s) => ({ groupId, profileId: s.id })))
      .onConflictDoNothing();
    revalidatePath(paths.group(groupId));
    return {
      status: "success",
      message: `${students.length} étudiant${students.length > 1 ? "s ajoutés" : " ajouté"}.`,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function removeMemberAction(_prev: State, formData: FormData): Promise<State> {
  try {
    const user = await requireTenant(...STAFF);
    const { groupId, profileId } = memberSchema.parse(Object.fromEntries(formData));
    await assertGroupInTenant(groupId, user.establishmentId, viewerOf(user));
    await getDb()
      .delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.profileId, profileId)));
    revalidatePath(paths.group(groupId));
    return { status: "success" };
  } catch (error) {
    return actionError(error);
  }
}
