"use client";

import { GraduationCap, Lightbulb, PlayCircle, RotateCcw, Timer } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatDuration, formatTotalDuration } from "@/domain/duration";
import { IDLE } from "@/lib/action-state";
import { startAttemptAction } from "../server/actions";

/** Démarrage d'un entraînement : sans code, sans plein écran, sans sanction. */
export function PracticeStart({
  examId,
  questionCount,
  minDurationSec,
  globalDurationSec = null,
  maxDurationSec,
  resumeAttemptId,
  tries,
}: {
  examId: string;
  questionCount: number;
  minDurationSec: number;
  /** Chrono global : durée de tout l'essai (sinon null). */
  globalDurationSec?: number | null;
  maxDurationSec: number;
  resumeAttemptId: string | null;
  tries: number;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const go = () => {
    setError(null);
    if (resumeAttemptId) {
      router.push(`/examen/${resumeAttemptId}` as Route);
      return;
    }
    const formData = new FormData();
    formData.set("examId", examId);
    start(async () => {
      const result = await startAttemptAction(IDLE, formData);
      if (result.status === "success" && result.data) {
        router.push(`/examen/${result.data.attemptId}` as Route);
      } else {
        setError(result.status === "error" ? result.message : "Démarrage impossible.");
      }
    });
  };

  const durations = globalDurationSec
    ? `${formatTotalDuration(globalDurationSec)} au total`
    : minDurationSec === maxDurationSec
      ? `${formatDuration(minDurationSec)} par question`
      : `de ${formatDuration(minDurationSec)} à ${formatDuration(maxDurationSec)} par question`;

  return (
    <Card className="mx-auto flex w-full max-w-2xl flex-col gap-6 p-8">
      <div className="flex items-center gap-3">
        <span className="flex size-12 items-center justify-center rounded-full bg-lilac text-primary-strong">
          <GraduationCap className="size-6" aria-hidden />
        </span>
        <div>
          <h2 className="font-display text-xl font-bold">Entraînement</h2>
          <p className="text-sm text-muted">Pour réviser à votre rythme : la note ne compte pas.</p>
        </div>
      </div>
      <ul className="flex flex-col gap-3 text-[15px]">
        <li className="flex items-start gap-3">
          <Timer className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <span>
            {questionCount} questions, {durations}, comme le jour de l&apos;examen.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <Lightbulb className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <span>
            Après chaque question : la bonne réponse et l&apos;explication. Le chrono suivant
            démarre quand vous êtes prêt.
          </span>
        </li>
        <li className="flex items-start gap-3">
          <RotateCcw className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <span>
            Recommencez autant de fois que vous voulez
            {tries > 0
              ? ` (${tries} essai${tries > 1 ? "s" : ""} déjà fait${tries > 1 ? "s" : ""})`
              : ""}
            . Les questions changent d&apos;ordre à chaque essai.
          </span>
        </li>
      </ul>
      {error ? (
        <p
          role="alert"
          className="rounded-xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger"
        >
          {error}
        </p>
      ) : null}
      <Button size="lg" variant="mint" disabled={pending} onClick={go}>
        <PlayCircle aria-hidden />
        {resumeAttemptId ? "Reprendre l'entraînement" : tries > 0 ? "Nouvel essai" : "Commencer"}
      </Button>
    </Card>
  );
}
