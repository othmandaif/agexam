"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldError, IDLE } from "@/lib/action-state";
import { createEstablishmentAction, updateEstablishmentAction } from "../server/actions";

/** Création (première configuration) ou renommage de l'établissement. */
export function EstablishmentForm({ defaultName }: { defaultName?: string }) {
  const isCreate = defaultName === undefined;
  const [state, action] = useActionState(
    isCreate ? createEstablishmentAction : updateEstablishmentAction,
    IDLE,
  );
  const error = fieldError(state, "name");

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="establishment-name">Nom de l&apos;établissement</Label>
        <div className="flex flex-wrap gap-3">
          <Input
            id="establishment-name"
            name="name"
            defaultValue={defaultName}
            placeholder="ex. ISTA Hay Riad"
            className="h-11 flex-[1_1_280px]"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "establishment-name-error" : undefined}
            required
          />
          <SubmitButton variant={isCreate ? "mint" : "primary"} pendingLabel="Enregistrement…">
            {isCreate ? "Créer l'établissement" : "Enregistrer"}
          </SubmitButton>
        </div>
        <FieldError id="establishment-name-error" message={error} />
      </div>
    </form>
  );
}
