"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Actualise la page à une heure donnée (ex. ouverture d'un examen). */
export function RefreshAt({ at }: { at: string }) {
  const router = useRouter();
  useEffect(() => {
    const delay = new Date(at).getTime() - Date.now() + 1_000;
    // setTimeout plafonne à ~24 jours ; au-delà, l'étudiant rechargera de lui-même.
    if (delay <= 0 || delay > 2 ** 31 - 1) return;
    const id = setTimeout(() => router.refresh(), delay);
    return () => clearTimeout(id);
  }, [at, router]);
  return null;
}
