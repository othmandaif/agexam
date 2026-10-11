"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * true uniquement dans le navigateur, après l'hydratation.
 * Utile pour ce qui dépend du fuseau horaire ou de l'heure locale.
 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
