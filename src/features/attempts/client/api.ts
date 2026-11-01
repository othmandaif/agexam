"use client";

import type { AttemptClientState, ClientSecurityEvent, EventsResponse, HelpItem } from "../types";

/** Erreur renvoyée par l'API (le serveur a répondu). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: { reason?: string; retryInSec?: number } | null,
  ) {
    super(message);
  }
}

/** L'examen est ouvert sur un autre appareil / onglet qui a la main. */
export const isSessionElsewhere = (error: unknown) =>
  error instanceof ApiError && error.details?.reason === "SESSION_ELSEWHERE";

/**
 * Identifiant de cet onglet pour la tentative : gardé dans sessionStorage
 * (survit à un rechargement, pas partagé avec un autre onglet ou appareil).
 */
let sessionId: string | null = null;

export function initAttemptSession(attemptId: string): string {
  const key = `agexam-session-${attemptId}`;
  try {
    sessionId = sessionStorage.getItem(key);
  } catch {
    sessionId = null;
  }
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    try {
      sessionStorage.setItem(key, sessionId);
    } catch {
      // Stockage indisponible : l'identifiant vit le temps de la page.
    }
  }
  return sessionId;
}

/** Erreur réseau (pas de réponse) : on considère la connexion perdue. */
export class NetworkError extends Error {}

/** Au-delà, la requête est considérée perdue (réseau instable) et sera renvoyée. */
const TIMEOUT_MS = 10_000;

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    res = await fetch(url, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(sessionId ? { "x-attempt-session": sessionId } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new NetworkError("Connexion perdue.");
  } finally {
    clearTimeout(timer);
  }
  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string; details?: { reason?: string; retryInSec?: number } };
  } | null;
  if (!res.ok) {
    throw new ApiError(
      json?.error?.message ?? "Erreur du serveur.",
      res.status,
      json?.error?.details ?? null,
    );
  }
  return json!.data as T;
}

const base = (attemptId: string) => `/api/v1/attempts/${attemptId}`;

export const attemptApi = {
  state: (attemptId: string) => call<AttemptClientState>(base(attemptId)),
  answer: (attemptId: string, attemptQuestionId: string, selectedOptionIds: string[]) =>
    call<{ accepted: boolean; state: AttemptClientState }>(`${base(attemptId)}/answer`, {
      method: "PUT",
      body: JSON.stringify({ attemptQuestionId, selectedOptionIds }),
    }),
  next: (
    attemptId: string,
    attemptQuestionId: string,
    selectedOptionIds: string[],
    code?: string,
  ) =>
    call<AttemptClientState>(`${base(attemptId)}/next`, {
      method: "POST",
      body: JSON.stringify({ attemptQuestionId, selectedOptionIds, code }),
    }),
  /** Algorithme en cours (sauvegarde régulière). */
  code: (attemptId: string, attemptQuestionId: string, code: string) =>
    call<{ accepted: boolean; state: AttemptClientState }>(`${base(attemptId)}/code`, {
      method: "PUT",
      body: JSON.stringify({ attemptQuestionId, code }),
    }),
  /** Entraînement : démarre la question suivante après la correction. */
  continue: (attemptId: string) =>
    call<AttemptClientState>(`${base(attemptId)}/continue`, { method: "POST" }),
  events: (attemptId: string, events: ClientSecurityEvent[]) =>
    call<EventsResponse>(`${base(attemptId)}/events`, {
      method: "POST",
      body: JSON.stringify({ events }),
      keepalive: true,
    }),
  /** Question au formateur ; renvoie les dernières questions et réponses. */
  help: (attemptId: string, message: string) =>
    call<HelpItem[]>(`${base(attemptId)}/help`, {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
  /** Heure du serveur, pour corriger l'horloge du PC. */
  serverTime: () => call<{ serverTime: number }>("/api/health"),
};
