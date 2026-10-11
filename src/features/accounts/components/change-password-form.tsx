"use client";

import { useActionState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldError, IDLE } from "@/lib/action-state";
import { changeOwnPasswordAction } from "../server/actions";

export function ChangePasswordForm() {
  const [state, action] = useActionState(changeOwnPasswordAction, IDLE);
  const pwdError = fieldError(state, "password");
  const confirmError = fieldError(state, "confirm");

  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state.status === "error" && !pwdError && !confirmError ? (
        <FormMessage state={state} />
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">Nouveau mot de passe</Label>
        <Input
          id="new-password"
          name="password"
          type="password"
          autoComplete="new-password"
          aria-invalid={pwdError ? true : undefined}
          aria-describedby="new-password-hint"
          required
        />
        <p id="new-password-hint" className="text-xs text-muted">
          10 caractères minimum, avec une majuscule, une minuscule et un chiffre.
        </p>
        <FieldError id="new-password-error" message={pwdError} />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password">Confirmer le mot de passe</Label>
        <Input
          id="confirm-password"
          name="confirm"
          type="password"
          autoComplete="new-password"
          aria-invalid={confirmError ? true : undefined}
          aria-describedby={confirmError ? "confirm-password-error" : undefined}
          required
        />
        <FieldError id="confirm-password-error" message={confirmError} />
      </div>

      <SubmitButton size="lg" variant="mint" pendingLabel="Enregistrement…">
        Enregistrer et continuer
      </SubmitButton>
    </form>
  );
}
