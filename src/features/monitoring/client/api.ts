"use client";

import type { AttemptTimeline, MonitorData } from "../types";

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json().catch(() => null)) as {
    data?: T;
    error?: { message?: string };
  } | null;
  if (!res.ok) throw new Error(json?.error?.message ?? "Erreur du serveur.");
  return json!.data as T;
}

export const monitorKeys = {
  board: (examId: string) => ["monitor", examId] as const,
  timeline: (examId: string, attemptId: string) => ["monitor", examId, attemptId] as const,
};

export const monitorApi = {
  board: (examId: string) => get<MonitorData>(`/api/v1/exams/${examId}/monitor`),
  timeline: (examId: string, attemptId: string) =>
    get<AttemptTimeline>(`/api/v1/exams/${examId}/monitor/${attemptId}`),
};
