"use client";

import { CheckCircle2, CircleAlert, CircleX, EyeOff, Send } from "lucide-react";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { IDLE } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { setHomeworkPublishedAction } from "../server/actions";

/**
 * Bandeau d'état en haut du devoir : dit clairement si les stagiaires le voient,
 * ce qui manque pour publier, et publie en un clic.
 */
export function PublishBanner({
  homeworkId,
  isPublished,
  stepCount,
  groupNames,
  readOnly,
}: {
  homeworkId: string;
  isPublished: boolean;
  stepCount: number;
  groupNames: string[];
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(setHomeworkPublishedAction, IDLE);
  const ready = stepCount > 0 && groupNames.length > 0;

  return (
    <form
      action={action}
      className={cn(
        "flex flex-wrap items-center gap-4 rounded-card border p-4",
        isPublished ? "border-success/40 bg-success-bg" : "border-[#f5d27a] bg-[#fffaf0]",
      )}
    >
      <input type="hidden" name="homeworkId" value={homeworkId} />
      <input type="hidden" name="publish" value={isPublished ? "0" : "1"} />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <p className="flex items-center gap-2 text-[15px] font-bold text-ink">
          {isPublished ? (
            <>
              <CheckCircle2 className="size-5 text-success" aria-hidden /> Publié : visible par les
              stagiaires de {groupNames.join(", ")}
            </>
          ) : (
            <>
              <CircleAlert className="size-5 text-[#d99a00]" aria-hidden /> Brouillon : les
              stagiaires ne voient pas encore ce devoir
            </>
          )}
        </p>
        {!isPublished ? (
          <ul className="flex flex-wrap gap-x-5 gap-y-1 text-[13px] font-semibold">
            <Check ok={stepCount > 0}>
              {stepCount > 0 ? `${stepCount} étape${stepCount > 1 ? "s" : ""}` : "Aucune étape"}
            </Check>
            <Check ok={groupNames.length > 0}>
              {groupNames.length ? `Groupe : ${groupNames.join(", ")}` : "Aucun groupe (Réglages)"}
            </Check>
          </ul>
        ) : null}
        <FormMessage state={state} />
      </div>
      {readOnly ? null : isPublished ? (
        <Button type="submit" variant="ghost" size="sm" disabled={pending}>
          <EyeOff aria-hidden /> Repasser en brouillon
        </Button>
      ) : (
        <Button type="submit" variant="mint" disabled={!ready || pending}>
          <Send aria-hidden /> {pending ? "Publication…" : "Publier maintenant"}
        </Button>
      )}
    </form>
  );
}

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("flex items-center gap-1.5", ok ? "text-success" : "text-danger")}>
      {ok ? (
        <CheckCircle2 className="size-4" aria-hidden />
      ) : (
        <CircleX className="size-4" aria-hidden />
      )}
      {children}
    </li>
  );
}
