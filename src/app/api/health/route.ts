import { ok } from "@/server/http/api";

/**
 * Vérification de disponibilité + heure du serveur.
 * Le navigateur s'en sert pour calculer son décalage d'horloge
 * (voir clockOffsetMs dans src/domain/attempt-timer.ts).
 */
export function GET() {
  return ok({ status: "ok", serverTime: Date.now() });
}
