/**
 * État renvoyé par les Server Actions aux formulaires (useActionState).
 * Partagé client / serveur : aucune dépendance serveur ici.
 */
export type ActionState<T = undefined> =
  | { status: "idle" }
  | { status: "success"; message?: string; data?: T }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[] | undefined> };

export const IDLE: ActionState<never> = { status: "idle" };

export function fieldError(state: ActionState<unknown>, field: string): string | undefined {
  return state.status === "error" ? state.fieldErrors?.[field]?.[0] : undefined;
}
