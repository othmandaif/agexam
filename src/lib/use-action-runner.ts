"use client";

import { useState, useTransition } from "react";
import { IDLE, type ActionState } from "./action-state";

/**
 * Lance une Server Action appelée avec des arguments directs (pas un formulaire)
 * et garde son dernier résultat pour l'afficher.
 */
export function useActionRunner() {
  const [state, setState] = useState<ActionState<unknown>>(IDLE);
  const [pending, start] = useTransition();
  const run = (action: () => Promise<ActionState<unknown>>, onSuccess?: () => void) =>
    start(async () => {
      const result = await action();
      setState(result);
      if (result.status === "success") onSuccess?.();
    });
  const reset = () => setState(IDLE);
  return { state, pending, run, reset };
}
