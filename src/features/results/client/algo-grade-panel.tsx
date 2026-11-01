"use client";

import { Check, PenLine, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { ActionState } from "@/lib/action-state";
import { IDLE } from "@/lib/action-state";
import { acceptAlgoGradeAction, regradeAlgoAction, setAlgoGradeAction } from "../server/actions";

/** Actions du formateur sur un algorithme : relancer la correction, noter à la main. */
export function AlgoGradePanel({
  attemptQuestionId,
  points,
  current,
  proposed = null,
  canRegrade = true,
}: {
  attemptQuestionId: string;
  points: number;
  current: number | null;
  /** Note proposée par la correction automatique, en attente de validation. */
  proposed?: number | null;
  /** Relance possible seulement si du code a été rendu. */
  canRegrade?: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<ActionState<unknown>>(IDLE);
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    proposed !== null ? String(proposed) : current !== null ? String(current) : "",
  );
  const [comment, setComment] = useState("");

  const run = (fn: () => Promise<ActionState<unknown>>) =>
    start(async () => {
      const r = await fn();
      setState(r);
      if (r.status === "success") {
        setEditing(false);
        router.refresh();
      }
    });

  return (
    <div className="flex flex-col gap-2 print:hidden">
      <FormMessage state={state} />
      {editing ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() =>
              setAlgoGradeAction(attemptQuestionId, Number(value.replace(",", ".")), comment),
            );
          }}
        >
          <label className="flex flex-col gap-1 text-xs font-bold text-muted">
            Points (sur {points})
            <Input
              type="number"
              step="0.25"
              min={0}
              max={points}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="h-9 w-28"
              required
            />
          </label>
          <label className="flex min-w-[220px] flex-1 flex-col gap-1 text-xs font-bold text-muted">
            Commentaire (facultatif)
            <Input value={comment} onChange={(e) => setComment(e.target.value)} className="h-9" />
          </label>
          <Button type="submit" size="sm" loading={pending}>
            Enregistrer
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={pending}>
            Annuler
          </Button>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          {proposed !== null ? (
            <Button
              size="sm"
              variant="mint"
              loading={pending}
              onClick={() => run(() => acceptAlgoGradeAction(attemptQuestionId))}
            >
              {pending ? null : <Check aria-hidden />} Valider la note proposée (
              {String(proposed).replace(".", ",")} / {points})
            </Button>
          ) : null}
          <Button variant="soft" size="sm" onClick={() => setEditing(true)} disabled={pending}>
            <PenLine aria-hidden /> Modifier la note
          </Button>
          {canRegrade ? (
            <Button
              variant="outline"
              size="sm"
              disabled={pending}
              onClick={() => run(() => regradeAlgoAction(attemptQuestionId))}
            >
              <RefreshCw className={pending ? "animate-spin" : undefined} aria-hidden />
              {pending ? "Correction…" : "Relancer la correction"}
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
