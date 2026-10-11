import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import type { TenantUser } from "@/server/auth/session";
import { getDb } from "@/server/db/client";
import { attempts, helpRequests } from "@/server/db/schema";
import { errors } from "@/server/http/errors";
import type { HelpItem } from "../types";

/** Question de l'étudiant au formateur, pendant sa tentative en cours. */
export async function askTrainer(student: TenantUser, attemptId: string, message: string) {
  const db = getDb();
  const [attempt] = await db
    .select({ status: attempts.status })
    .from(attempts)
    .where(and(eq(attempts.id, attemptId), eq(attempts.studentId, student.id)))
    .limit(1);
  if (!attempt) throw errors.notFound("Tentative introuvable.");
  if (attempt.status !== "EN_COURS") throw errors.conflict("L'examen est terminé.");
  const [{ pending, recent }] = (await db
    .select({
      pending: sql<number>`count(*) filter (where ${helpRequests.answeredAt} is null)::int`,
      recent: sql<number>`count(*) filter (where ${helpRequests.createdAt} > now() - interval '20 seconds')::int`,
    })
    .from(helpRequests)
    .where(eq(helpRequests.attemptId, attemptId))) as [{ pending: number; recent: number }];
  if (recent > 0) throw errors.conflict("Patientez quelques secondes avant une nouvelle question.");
  if (pending >= 3) throw errors.conflict("Attendez la réponse du formateur à vos questions.");
  await db.insert(helpRequests).values({ attemptId, message });
}

/** Dernières questions de la tentative et leurs réponses (affichées à l'étudiant). */
export async function listHelp(attemptId: string): Promise<HelpItem[]> {
  const rows = await getDb()
    .select({
      id: helpRequests.id,
      message: helpRequests.message,
      answer: helpRequests.answer,
      at: helpRequests.createdAt,
    })
    .from(helpRequests)
    .where(eq(helpRequests.attemptId, attemptId))
    .orderBy(desc(helpRequests.createdAt))
    .limit(5);
  return rows.map((r) => ({ ...r, at: r.at.toISOString() }));
}
