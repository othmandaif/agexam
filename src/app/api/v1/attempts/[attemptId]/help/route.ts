import { z } from "zod";
import { askTrainer, listHelp } from "@/features/attempts/server/help";
import { attemptParamsSchema } from "@/features/attempts/schemas";
import { requireApiTenant } from "@/server/auth/session";
import { apiRoute, ok, parseBody } from "@/server/http/api";

const helpSchema = z.object({ message: z.string().trim().min(2).max(500) });

/** Question posée au formateur pendant l'examen. */
export const POST = apiRoute<{ attemptId: string }>(async (req, { params }) => {
  const student = await requireApiTenant("ETUDIANT");
  const { attemptId } = attemptParamsSchema.parse(await params);
  const { message } = await parseBody(req, helpSchema);
  await askTrainer(student, attemptId, message);
  return ok(await listHelp(attemptId));
});
