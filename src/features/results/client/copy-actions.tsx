"use client";

import { Flag, FlagOff, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import type { AttemptStatus } from "@/domain/enums";
import { useActionRunner } from "@/lib/use-action-runner";
import { allowRetakeAction, reviewAttemptAction } from "../server/actions";

/** Actions du formateur sur une copie : vérifiée / à revoir, autoriser à repasser. */
export function CopyActions({
  attemptId,
  status,
  flagged,
  studentName,
}: {
  attemptId: string;
  status: AttemptStatus;
  flagged: boolean;
  studentName: string;
}) {
  const { state, pending, run } = useActionRunner();
  const finished = status !== "EN_COURS" && status !== "ANNULEE";
  return (
    <div className="flex flex-col items-end gap-2 print:hidden">
      <div className="flex flex-wrap justify-end gap-2">
        {finished ? (
          flagged ? (
            <Button
              variant="mint"
              size="sm"
              disabled={pending}
              onClick={() => run(() => reviewAttemptAction(attemptId, true))}
            >
              <FlagOff aria-hidden /> Marquer vérifiée
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              disabled={pending}
              onClick={() => run(() => reviewAttemptAction(attemptId, false))}
            >
              <Flag aria-hidden /> Signaler à revoir
            </Button>
          )
        ) : null}
        {finished ? (
          <Button
            variant="danger"
            size="sm"
            disabled={pending}
            onClick={() => {
              if (
                window.confirm(
                  `Autoriser ${studentName} à repasser l'examen ? Cette copie sera annulée (elle reste dans l'historique) et l'étudiant pourra recommencer tant que l'examen est ouvert.`,
                )
              ) {
                run(() => allowRetakeAction(attemptId));
              }
            }}
          >
            <RotateCcw aria-hidden /> Autoriser à repasser
          </Button>
        ) : null}
      </div>
      <FormMessage state={state} className="max-w-md" />
    </div>
  );
}
