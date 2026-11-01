/** Erreur de pseudo-code, avec la ligne concernée et un message pédagogique. */
export type AlgoErrorKind = "syntax" | "runtime" | "input" | "limit";

export class AlgoError extends Error {
  constructor(
    public readonly kind: AlgoErrorKind,
    public readonly line: number | null,
    message: string,
    public readonly hint?: string,
  ) {
    super(message);
    this.name = "AlgoError";
  }
}

export interface AlgoErrorInfo {
  kind: AlgoErrorKind;
  line: number | null;
  message: string;
  hint?: string;
}

export const errorInfo = (e: AlgoError): AlgoErrorInfo => ({
  kind: e.kind,
  line: e.line,
  message: e.message,
  ...(e.hint ? { hint: e.hint } : {}),
});
