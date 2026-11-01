"use client";

import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { useActionRunner } from "@/lib/use-action-runner";
import { acceptAllGradesAction } from "../server/actions";

/** Valide d'un coup toutes les notes proposées de l'examen. */
export function AcceptAllButton({ examId, count }: { examId: string; count: number }) {
  const { state, pending, run } = useActionRunner();
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="mint"
        loading={pending}
        onClick={() => {
          if (
            window.confirm(
              `Valider les ${count} note${count > 1 ? "s" : ""} proposée${count > 1 ? "s" : ""} telles quelles ?`,
            )
          )
            run(() => acceptAllGradesAction(examId));
        }}
      >
        {pending ? null : <CheckCheck aria-hidden />}{" "}
        {pending ? "Validation…" : `Tout valider (${count})`}
      </Button>
      <FormMessage state={state} />
    </div>
  );
}
