"use client";

import { useActionState, useEffect, useRef } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldError, IDLE } from "@/lib/action-state";
import { createModuleAction, updateModuleAction } from "../server/actions";

interface ModuleFormProps {
  /** Absent : création. Présent : modification. */
  module?: { id: string; code: string; name: string };
}

export function ModuleForm({ module }: ModuleFormProps) {
  const [state, action] = useActionState(module ? updateModuleAction : createModuleAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);

  // Vide le formulaire de création après un succès.
  useEffect(() => {
    if (!module && state.status === "success") formRef.current?.reset();
  }, [module, state]);

  const codeError = fieldError(state, "code");
  const nameError = fieldError(state, "name");
  const prefix = module ? `module-${module.id}` : "module-new";

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-4">
      <FormMessage state={state} />
      {module ? <input type="hidden" name="moduleId" value={module.id} /> : null}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-[0_1_140px] flex-col gap-2">
          <Label htmlFor={`${prefix}-code`}>Code</Label>
          <Input
            id={`${prefix}-code`}
            name="code"
            defaultValue={module?.code}
            placeholder="M104"
            className="h-11 uppercase"
            aria-invalid={codeError ? true : undefined}
            aria-describedby={codeError ? `${prefix}-code-error` : undefined}
            required
          />
          <FieldError id={`${prefix}-code-error`} message={codeError} />
        </div>
        <div className="flex flex-[1_1_260px] flex-col gap-2">
          <Label htmlFor={`${prefix}-name`}>Intitulé</Label>
          <Input
            id={`${prefix}-name`}
            name="name"
            defaultValue={module?.name}
            placeholder="Algorithmique"
            className="h-11"
            aria-invalid={nameError ? true : undefined}
            aria-describedby={nameError ? `${prefix}-name-error` : undefined}
            required
          />
          <FieldError id={`${prefix}-name-error`} message={nameError} />
        </div>
        <SubmitButton className="mt-7" pendingLabel="Enregistrement…">
          {module ? "Enregistrer" : "Ajouter le module"}
        </SubmitButton>
      </div>
    </form>
  );
}
