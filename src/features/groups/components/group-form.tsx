"use client";

import { useActionState, useEffect, useRef } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldError, IDLE } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { createGroupAction, updateGroupAction } from "../server/actions";

interface GroupFormProps {
  group?: { id: string; name: string; label: string | null };
  /** Disposition en colonne (carte latérale) ou en ligne. */
  layout?: "stack" | "row";
}

export function GroupForm({ group, layout = "row" }: GroupFormProps) {
  const [state, action] = useActionState(group ? updateGroupAction : createGroupAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!group && state.status === "success") formRef.current?.reset();
  }, [group, state]);

  const nameError = fieldError(state, "name");
  const labelError = fieldError(state, "label");
  const prefix = group ? `group-${group.id}` : "group-new";
  const stack = layout === "stack";

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <FormMessage state={state} />
      {group ? <input type="hidden" name="groupId" value={group.id} /> : null}
      <div className={cn("flex gap-3", stack ? "flex-col" : "flex-wrap items-start")}>
        <div className={cn("flex flex-col gap-2", !stack && "flex-[0_1_180px]")}>
          <Label htmlFor={`${prefix}-name`}>Nom du groupe</Label>
          <Input
            id={`${prefix}-name`}
            name="name"
            defaultValue={group?.name}
            placeholder="DEV101"
            className="h-11 uppercase"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${prefix}-name-error` : undefined}
            required
          />
          <FieldError id={`${prefix}-name-error`} message={nameError} />
        </div>
        <div className={cn("flex flex-col gap-2", !stack && "flex-[1_1_260px]")}>
          <Label htmlFor={`${prefix}-label`}>
            Description <span className="font-normal text-muted">(facultatif)</span>
          </Label>
          <Input
            id={`${prefix}-label`}
            name="label"
            defaultValue={group?.label ?? ""}
            placeholder="Développement digital, 1re année"
            className="h-11"
            aria-invalid={labelError ? true : undefined}
          />
          <FieldError id={`${prefix}-label-error`} message={labelError} />
        </div>
        <SubmitButton
          variant={group ? "primary" : "mint"}
          className={stack ? "" : "mt-7"}
          pendingLabel="Enregistrement…"
        >
          {group ? "Enregistrer" : "Créer le groupe"}
        </SubmitButton>
      </div>
    </form>
  );
}
