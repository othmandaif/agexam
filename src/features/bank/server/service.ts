import "server-only";
import { and, eq } from "drizzle-orm";
import type { Difficulty } from "@/domain/enums";
import { audit } from "@/server/audit";
import type { TenantUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { chapters, questions } from "@/server/db/schema";
import { errors } from "@/server/http/errors";

/** Question de l'établissement que l'utilisateur peut modifier (auteur ou admin). */
async function editableQuestion(staff: TenantUser, questionId: string) {
  const [q] = await getDb()
    .select({ id: questions.id, moduleId: questions.moduleId, authorId: questions.authorId })
    .from(questions)
    .where(and(eq(questions.id, questionId), eq(questions.establishmentId, staff.establishmentId)))
    .limit(1);
  if (!q) throw errors.notFound("Question introuvable.");
  if (staff.role !== "ADMIN" && q.authorId !== staff.id) {
    throw errors.forbidden("Seul l'auteur de la question ou un administrateur peut la modifier.");
  }
  return q;
}

/** Classement de la question : difficulté et chapitre (le contenu se modifie dans un examen). */
export async function updateQuestionMeta(
  staff: TenantUser,
  questionId: string,
  input: { difficulty: Difficulty; chapterId: string | null },
) {
  const q = await editableQuestion(staff, questionId);
  if (input.chapterId) {
    const [chapter] = await getDb()
      .select({ id: chapters.id })
      .from(chapters)
      .where(and(eq(chapters.id, input.chapterId), eq(chapters.moduleId, q.moduleId)))
      .limit(1);
    if (!chapter) throw errors.badRequest("Ce chapitre n'appartient pas au module de la question.");
  }
  await getDb().transaction(async (tx) => {
    await tx
      .update(questions)
      .set({ difficulty: input.difficulty, chapterId: input.chapterId })
      .where(eq(questions.id, q.id));
    await audit(tx, {
      actorId: staff.id,
      action: "question.update_meta",
      entityType: "question",
      entityId: q.id,
      payload: input,
    });
  });
}

/**
 * Archive (ou restaure) une question : elle disparaît de la banque et n'est plus
 * proposée. Les examens qui l'utilisent ne changent pas.
 */
export async function setQuestionArchived(
  staff: TenantUser,
  questionId: string,
  archived: boolean,
) {
  const q = await editableQuestion(staff, questionId);
  await getDb().transaction(async (tx) => {
    await tx
      .update(questions)
      .set({ archivedAt: archived ? new Date() : null })
      .where(eq(questions.id, q.id));
    await audit(tx, {
      actorId: staff.id,
      action: archived ? "question.archive" : "question.restore",
      entityType: "question",
      entityId: q.id,
    });
  });
}
