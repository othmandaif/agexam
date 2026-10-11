export type AppErrorCode =
  | "BAD_REQUEST"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "GONE"
  | "RATE_LIMITED"
  | "INTERNAL";

const STATUS: Record<AppErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  GONE: 410,
  RATE_LIMITED: 429,
  INTERNAL: 500,
};

/** Erreur métier prévue : son message peut être montré à l'utilisateur. */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}

export const errors = {
  badRequest: (message = "Requête invalide.", details?: unknown) =>
    new AppError("BAD_REQUEST", message, details),
  unauthenticated: (message = "Connexion requise.") => new AppError("UNAUTHENTICATED", message),
  forbidden: (message = "Accès refusé.") => new AppError("FORBIDDEN", message),
  notFound: (message = "Introuvable.") => new AppError("NOT_FOUND", message),
  conflict: (message: string) => new AppError("CONFLICT", message),
  /** Ex. réponse reçue après l'expiration de la question. */
  gone: (message: string) => new AppError("GONE", message),
};
