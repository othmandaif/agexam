import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z, ZodError } from "zod";
import { AppError, errors } from "./errors";

/** Format unique des réponses API : `{ data }` ou `{ error: { code, message, details? } }`. */
export type ApiSuccess<T> = { data: T };
export type ApiFailure = { error: { code: string; message: string; details?: unknown } };

const NO_STORE = { "Cache-Control": "no-store" };

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json<ApiSuccess<T>>(
    { data },
    { ...init, headers: { ...NO_STORE, ...init?.headers } },
  );
}

function fail(status: number, error: ApiFailure["error"]) {
  return NextResponse.json<ApiFailure>({ error }, { status, headers: NO_STORE });
}

export function toErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return fail(error.status, { code: error.code, message: error.message, details: error.details });
  }
  if (error instanceof ZodError) {
    return fail(400, {
      code: "BAD_REQUEST",
      message: "Données invalides.",
      details: z.flattenError(error).fieldErrors,
    });
  }
  console.error("[api] erreur inattendue", error);
  return fail(500, { code: "INTERNAL", message: "Erreur interne." });
}

type RouteContext<P> = { params: Promise<P> };

/**
 * Enveloppe commune des routes API : erreurs converties au format standard,
 * jamais de fuite de pile d'appels vers le client.
 */
export function apiRoute<P = Record<string, never>>(
  handler: (request: NextRequest, context: RouteContext<P>) => Promise<Response>,
) {
  return async (request: NextRequest, context: RouteContext<P>) => {
    try {
      return await handler(request, context);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/** Lit et valide le corps JSON. Tout ce qui vient du client est validé. */
export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<z.infer<S>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw errors.badRequest("Corps JSON invalide.");
  }
  return schema.parse(body);
}
