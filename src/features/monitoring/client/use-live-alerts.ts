"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { SANCTION_LABELS } from "../labels";
import type { MonitorData } from "../types";

// ─── Préférences (navigateur) ────────────────────────────────────────────────

const flagListeners = new Set<() => void>();

function readFlag(key: string, fallback: boolean): boolean {
  try {
    const v = window.localStorage.getItem(key);
    return v === null ? fallback : v === "1";
  } catch {
    return fallback;
  }
}

/** Préférence booléenne mémorisée dans le navigateur (sans erreur si le stockage est bloqué). */
export function useStoredFlag(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      flagListeners.add(cb);
      window.addEventListener("storage", cb);
      return () => {
        flagListeners.delete(cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => readFlag(key, fallback),
    () => fallback,
  );
  const set = useCallback(
    (next: boolean) => {
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        /* stockage indisponible : préférence non mémorisée */
      }
      flagListeners.forEach((cb) => cb());
    },
    [key],
  );
  return [value, set];
}

// ─── Son ─────────────────────────────────────────────────────────────────────

let audioCtx: AudioContext | null = null;

/** À appeler sur un clic : débloque le son (politique des navigateurs). */
export function unlockAudio() {
  try {
    audioCtx ??= new AudioContext();
    void audioCtx.resume();
  } catch {
    /* pas de son disponible */
  }
}

/** Deux bips courts, plus graves pour une alerte grave. */
export function playBeep(severe: boolean) {
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    void ctx.resume();
    const tones = severe ? [880, 660] : [740, 740];
    tones.forEach((freq, i) => {
      const t = ctx.currentTime + i * 0.18;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.16);
    });
  } catch {
    /* pas de son disponible */
  }
}

// ─── Détection des nouveautés ───────────────────────────────────────────────

export type ToastTone = "danger" | "warning" | "success" | "info";

export interface LiveToast {
  id: string;
  tone: ToastTone;
  title: string;
  body?: string;
  /** Tentative concernée : un clic sur la notification ouvre l'étudiant. */
  attemptId?: string | null;
}

interface Tracker {
  source: MonitorData | null;
  seenAlerts: Set<string>;
  seenHelp: Set<string>;
  offline: Set<string>;
  toasts: LiveToast[];
  /** Dernier lot d'alertes nouvelles (pour le son et la notification). */
  batch: { id: number; items: LiveToast[] };
}

const MAX_TOASTS = 5;

function snapshot(data: MonitorData) {
  return {
    seenAlerts: new Set(data.alerts.map((a) => a.id)),
    seenHelp: new Set((data.help ?? []).map((h) => h.id)),
    offline: new Set(data.students.filter((s) => s.status === "OFFLINE").map((s) => s.profileId)),
  };
}

/** Nouveautés entre deux rafraîchissements : nouvelles sanctions, étudiants hors ligne. */
export function diffAlerts(prev: ReturnType<typeof snapshot>, data: MonitorData): LiveToast[] {
  const items: LiveToast[] = [];
  for (const a of [...data.alerts].reverse()) {
    if (prev.seenAlerts.has(a.id) || a.revoked) continue;
    items.push({
      id: `alert-${a.id}`,
      tone:
        a.sanction === "SOUMISSION_AUTO" || a.sanction === "INVALIDER_QUESTION"
          ? "danger"
          : "warning",
      title: `${a.studentName} · ${SANCTION_LABELS[a.sanction]}`,
      body: `Violation n° ${a.violationNumber} : sortie du mode examen.`,
      attemptId: a.attemptId,
    });
  }
  for (const h of data.help ?? []) {
    if (prev.seenHelp.has(h.id) || h.answer) continue;
    items.push({
      id: `help-${h.id}`,
      tone: "danger",
      title: `${h.studentName} pose une question`,
      body: h.message,
      attemptId: h.attemptId,
    });
  }
  for (const s of data.students) {
    if (s.status === "OFFLINE" && !prev.offline.has(s.profileId)) {
      items.push({
        id: `offline-${s.profileId}-${data.serverNow}`,
        tone: "warning",
        title: `${s.fullName} · hors ligne`,
        body: "Plus aucun signal depuis le poste de l'étudiant.",
        attemptId: s.attemptId,
      });
    }
  }
  return items;
}

/**
 * Suit les données du tableau et produit des notifications pour ce qui est nouveau.
 * Au premier chargement, rien n'est notifié (on ne réveille pas pour l'historique).
 */
export function useLiveAlerts(
  data: MonitorData | undefined,
  options: { sound: boolean; notify: boolean; examTitle: string },
) {
  const [tracker, setTracker] = useState<Tracker>(() => ({
    source: data ?? null,
    ...(data
      ? snapshot(data)
      : { seenAlerts: new Set<string>(), seenHelp: new Set<string>(), offline: new Set<string>() }),
    toasts: [],
    batch: { id: 0, items: [] },
  }));

  // Ajustement pendant le rendu (pas d'effet) quand de nouvelles données arrivent.
  if (data && data !== tracker.source) {
    const items = tracker.source ? diffAlerts(tracker, data) : [];
    setTracker((t) => ({
      source: data,
      ...snapshot(data),
      toasts: [...items, ...t.toasts].slice(0, MAX_TOASTS),
      batch: items.length ? { id: t.batch.id + 1, items } : t.batch,
    }));
  }

  const lastBatch = useRef(tracker.batch.id);
  useEffect(() => {
    const { id, items } = tracker.batch;
    if (id === lastBatch.current || items.length === 0) return;
    lastBatch.current = id;
    if (options.sound) playBeep(items.some((i) => i.tone === "danger"));
    if (
      options.notify &&
      typeof Notification !== "undefined" &&
      Notification.permission === "granted" &&
      document.hidden
    ) {
      try {
        const first = items[0]!;
        new Notification(
          items.length > 1
            ? `${items.length} nouvelles alertes · ${options.examTitle}`
            : first.title,
          {
            body: items.length > 1 ? items.map((i) => i.title).join("\n") : first.body,
            tag: "agexam-monitor",
          },
        );
      } catch {
        /* notifications indisponibles */
      }
    }
  }, [tracker.batch, options.sound, options.notify, options.examTitle]);

  const push = useCallback((toast: Omit<LiveToast, "id">) => {
    setTracker((t) => ({
      ...t,
      toasts: [{ ...toast, id: `local-${Date.now()}-${Math.random()}` }, ...t.toasts].slice(
        0,
        MAX_TOASTS,
      ),
    }));
  }, []);

  const dismiss = useCallback((id: string) => {
    setTracker((t) => ({ ...t, toasts: t.toasts.filter((x) => x.id !== id) }));
  }, []);

  return { toasts: tracker.toasts, push, dismiss };
}
