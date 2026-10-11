import "server-only";
import { unstable_rethrow } from "next/navigation";
import { z, ZodError } from "zod";
import { AppError } from "@/server/http/errors";
import type { ActionState } from "@/lib/action-state";

const PG_UNIQUE_VIOLATION = "23505";
const PG_FOREIGN_KEY_VIOLATION = "23503";

function pgCode(error: unknown): string | undefined {
  const candidates = [error, (error as { cause?: unknown })?.cause];
  for (const c of candidates) {
    const code = (c as { code?: unknown })?.code;
    if (typeof code === "string") return code;
  }
  return undefined;
}

/**
 * Convertit une erreur en état d'action affichable.
 * Laisse passer redirect() / notFound() de Next.js.
 */
export function actionError(error: unknown): ActionState<never> {
  unstable_rethrow(error);

  if (error instanceof AppError) {
    return { status: "error", message: error.message };
  }
  if (error instanceof ZodError) {
    return {
      status: "error",
      message: "Certains champs sont invalides.",
      fieldErrors: z.flattenError(error).fieldErrors as Record<string, string[]>,
    };
  }
  const code = pgCode(error);
  if (code === PG_UNIQUE_VIOLATION) {
    return { status: "error", message: "Cet élément existe déjà." };
  }
  if (code === PG_FOREIGN_KEY_VIOLATION) {
    return {
      status: "error",
      message: "Suppression impossible : cet élément est encore utilisé.",
    };
  }
  console.error("[action] erreur inattendue", error);
  return { status: "error", message: "Une erreur est survenue. Réessayez." };
}
