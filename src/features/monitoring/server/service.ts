import "server-only";
import { eq } from "drizzle-orm";
import { examPhase } from "@/domain/exam-lifecycle";
import { addTimeToCurrentQuestion, revokeIncident } from "@/features/attempts/server/engine";
import { getEditableExam } from "@/features/exams/server/service";
import { audit } from "@/server/audit";
import type { TenantUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { attempts, exams, helpRequests, incidents } from "@/server/db/schema";
import { errors } from "@/server/http/errors";

/** Tentative d'un examen que le formateur gère. */
async function manageableAttempt(staff: TenantUser, attemptId: string) {
  const [row] = await getDb()
    .select({ id: attempts.id, examId: attempts.examId })
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);
  if (!row) throw errors.notFound("Tentative introuvable.");
  await getEditableExam(staff, row.examId);
  return row;
}

export async function cancelSanction(staff: TenantUser, incidentId: string) {
  const [incident] = await getDb()
    .select({
      id: incidents.id,
      attemptId: incidents.attemptId,
      attemptQuestionId: incidents.attemptQuestionId,
      sanction: incidents.sanction,
      revokedAt: incidents.revokedAt,
    })
    .from(incidents)
    .where(eq(incidents.id, incidentId))
    .limit(1);
  if (!incident) throw errors.notFound("Sanction introuvable.");
  await manageableAttempt(staff, incident.attemptId);
  if (incident.revokedAt) throw errors.conflict("Cette sanction est déjà annulée.");

  const result = await revokeIncident(staff.id, incident);
  await audit(getDb(), {
    actorId: staff.id,
    action: "incident.revoke",
    entityType: "incident",
    entityId: incident.id,
    payload: { sanction: incident.sanction, reopened: result.reopened },
  });
  return result;
}

export const ALLOWED_EXTRA_SECONDS = [30, 60, 120, 300] as const;

export async function addTime(staff: TenantUser, attemptId: string, seconds: number) {
  if (!(ALLOWED_EXTRA_SECONDS as readonly number[]).includes(seconds)) {
    throw errors.badRequest("Durée non autorisée.");
  }
  await manageableAttempt(staff, attemptId);
  const expiresAt = await addTimeToCurrentQuestion(attemptId, seconds);
  await audit(getDb(), {
    actorId: staff.id,
    action: "attempt.add_time",
    entityType: "attempt",
    entityId: attemptId,
    payload: { seconds },
  });
  return expiresAt;
}

/** Message affiché à tous les étudiants de l'examen (vide = effacer). */
export async function broadcastMessage(staff: TenantUser, examId: string, message: string) {
  const exam = await getEditableExam(staff, examId);
  const text = message.trim();
  await getDb()
    .update(exams)
    .set({ liveMessage: text || null, liveMessageAt: text ? new Date() : null })
    .where(eq(exams.id, exam.id));
}

/** Repousse la fermeture de l'examen. */
export async function extendExam(staff: TenantUser, examId: string, minutes: number) {
  const exam = await getEditableExam(staff, examId);
  if (exam.status === "BROUILLON" || exam.status === "FERME" || exam.status === "ARCHIVE") {
    throw errors.conflict("Seul un examen publié et non fermé peut être prolongé.");
  }
  if (!exam.closesAt) throw errors.conflict("L'examen n'a pas de date de fermeture.");
  const base = examPhase(exam, new Date()) === "FERME" ? new Date() : exam.closesAt;
  const closesAt = new Date(base.getTime() + minutes * 60_000);
  await getDb().update(exams).set({ closesAt }).where(eq(exams.id, exam.id));
  await audit(getDb(), {
    actorId: staff.id,
    action: "exam.extend",
    entityType: "exam",
    entityId: exam.id,
    payload: { minutes },
  });
  return closesAt;
}

/** Réponse du formateur à la question d'un étudiant (affichée sur son écran). */
export async function answerHelp(staff: TenantUser, helpId: string, answer: string) {
  const [row] = await getDb()
    .select({ attemptId: helpRequests.attemptId })
    .from(helpRequests)
    .where(eq(helpRequests.id, helpId))
    .limit(1);
  if (!row) throw errors.notFound("Question introuvable.");
  await manageableAttempt(staff, row.attemptId);
  await getDb()
    .update(helpRequests)
    .set({ answer, answeredAt: new Date(), answeredBy: staff.id })
    .where(eq(helpRequests.id, helpId));
}
