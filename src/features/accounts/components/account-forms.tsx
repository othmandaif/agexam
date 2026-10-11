"use client";

import { KeyRound } from "lucide-react";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { USER_ROLES, type UserRole } from "@/domain/enums";
import { fieldError, IDLE, type ActionState } from "@/lib/action-state";
import { ROLE_LABELS } from "../schemas";
import {
  resetPasswordAction,
  updateNameAction,
  updateRoleAction,
  type Credentials,
} from "../server/actions";
import { CredentialsNotice } from "./credentials-notice";

export function AccountNameForm({ userId, fullName }: { userId: string; fullName: string }) {
  const [state, action] = useActionState(updateNameAction, IDLE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="userId" value={userId} />
      <Label htmlFor="account-name">Nom complet</Label>
      <div className="flex flex-wrap gap-3">
        <Input
          id="account-name"
          name="fullName"
          defaultValue={fullName}
          className="h-11 flex-[1_1_240px]"
          aria-invalid={fieldError(state, "fullName") ? true : undefined}
          required
        />
        <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
      </div>
    </form>
  );
}

interface AccountRoleFormProps {
  userId: string;
  role: UserRole;
  /** Interdit de modifier son propre rôle. */
  disabled?: boolean;
}

export function AccountRoleForm({ userId, role, disabled }: AccountRoleFormProps) {
  const [state, action] = useActionState(updateRoleAction, IDLE);
  return (
    <form action={action} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="userId" value={userId} />
      <Label htmlFor="account-role">Rôle</Label>
      <div className="flex flex-wrap gap-3">
        <div className="flex-[1_1_220px]">
          <Select id="account-role" name="role" defaultValue={role} disabled={disabled}>
            {USER_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
        </div>
        <SubmitButton disabled={disabled} pendingLabel="Enregistrement…">
          Changer le rôle
        </SubmitButton>
      </div>
      {disabled ? (
        <p className="text-xs text-muted">Vous ne pouvez pas modifier votre propre rôle.</p>
      ) : null}
    </form>
  );
}

interface ResetPasswordFormProps {
  userId: string;
  fullName: string;
  email: string;
}

export function ResetPasswordForm({ userId, fullName, email }: ResetPasswordFormProps) {
  const [state, action] = useActionState<ActionState<Credentials>, FormData>(
    resetPasswordAction,
    IDLE,
  );
  return (
    <div className="flex flex-col gap-3">
      <form
        action={action}
        onSubmit={(event) => {
          if (!window.confirm(`Générer un nouveau mot de passe provisoire pour ${fullName} ?`)) {
            event.preventDefault();
          }
        }}
      >
        <input type="hidden" name="userId" value={userId} />
        <input type="hidden" name="fullName" value={fullName} />
        <input type="hidden" name="email" value={email} />
        <SubmitButton variant="outline" pendingLabel="Génération…">
          <KeyRound aria-hidden /> Réinitialiser le mot de passe
        </SubmitButton>
      </form>
      {state.status === "error" ? <FormMessage state={state} /> : null}
      {state.status === "success" && state.data ? (
        <CredentialsNotice
          fullName={state.data.fullName}
          email={state.data.email}
          tempPassword={state.data.tempPassword}
        />
      ) : null}
    </div>
  );
}
