"use client";

import { formatDateTime, formatTime } from "@/lib/datetime";
import { useIsClient } from "@/lib/use-is-client";

/**
 * Heure formatée dans le navigateur seulement : le serveur et le navigateur
 * n'ont pas toujours la même base de fuseaux (Africa/Casablanca), ce qui
 * cassait l'hydratation des composants client.
 */
export function LocalTime({
  date,
  withDate = false,
}: {
  date: string | Date | null | undefined;
  withDate?: boolean;
}) {
  const isClient = useIsClient();
  if (!date) return <>—</>;
  const d = new Date(date);
  return (
    <time dateTime={d.toISOString()}>
      {isClient ? (withDate ? formatDateTime(d) : formatTime(d)) : "…"}
    </time>
  );
}
