import type { Metadata, Route } from "next";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ExamRunner } from "@/features/attempts/client/exam-runner";
import { peekAttemptState } from "@/features/attempts/server/engine";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";

export const metadata: Metadata = { title: "Examen en cours" };

export default async function ExamAttemptPage({
  params,
}: {
  params: Promise<{ attemptId: string }>;
}) {
  const student = await requireTenant("ETUDIANT");
  const { attemptId } = await params;
  if (!z.uuid().safeParse(attemptId).success) notFound();

  let state;
  try {
    // Seule la tentative de l'étudiant connecté est trouvée (sinon 404).
    // Sans la question : elle est chargée par l'onglet qui obtient la main.
    state = await peekAttemptState(student, attemptId);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") notFound();
    throw error;
  }
  if (state.finished) redirect(`/etudiant/resultats/${attemptId}` as Route);

  return <ExamRunner initialState={state} />;
}
