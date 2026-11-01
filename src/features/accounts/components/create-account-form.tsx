"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { FieldError, FormMessage, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { USER_ROLES, type UserRole } from "@/domain/enums";
import { fieldError, IDLE, type ActionState } from "@/lib/action-state";
import { ROLE_LABELS } from "../schemas";
import { createAccountAction, type Credentials } from "../server/actions";
import { CredentialsNotice } from "./credentials-notice";

interface CreateAccountFormProps {
  groups: { id: string; name: string }[];
  /** Formateur : comptes étudiants uniquement (rôle aussi imposé côté serveur). */
  studentOnly?: boolean;
}

export function CreateAccountForm({ groups, studentOnly = false }: CreateAccountFormProps) {
  const [state, action] = useActionState<ActionState<Credentials>, FormData>(
    createAccountAction,
    IDLE,
  );
  const [role, setRole] = useState<UserRole>(studentOnly ? "ETUDIANT" : "FORMATEUR");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);

  const err = (field: string) => fieldError(state, field);

  return (
    <div className="flex flex-col gap-4">
      <form ref={formRef} action={action} className="flex flex-col gap-4">
        {state.status === "error" ? <FormMessage state={state} /> : null}

        <div className="flex flex-col gap-2">
          <Label htmlFor="acc-name">Nom complet</Label>
          <Input
            id="acc-name"
            name="fullName"
            placeholder="Salma Benali"
            className="h-11"
            aria-invalid={err("fullName") ? true : undefined}
            aria-describedby={err("fullName") ? "acc-name-error" : undefined}
            required
          />
          <FieldError id="acc-name-error" message={err("fullName")} />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="acc-email">E-mail</Label>
          <Input
            id="acc-email"
            name="email"
            type="email"
            placeholder="s.benali@etab.ma"
            className="h-11"
            aria-invalid={err("email") ? true : undefined}
            aria-describedby={err("email") ? "acc-email-error" : undefined}
            required
          />
          <FieldError id="acc-email-error" message={err("email")} />
        </div>

        {studentOnly ? (
          <input type="hidden" name="role" value="ETUDIANT" />
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="acc-role">Rôle</Label>
            <Select
              id="acc-role"
              name="role"
              value={role}
              onChange={(e) => setRole(e.target.value as UserRole)}
            >
              {USER_ROLES.filter((r) => r !== "ETUDIANT").map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </Select>
          </div>
        )}

        {studentOnly || role === "ETUDIANT" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="acc-group">
              Groupe{" "}
              {studentOnly ? (
                <span className="text-danger">*</span>
              ) : (
                <span className="font-normal text-muted">(facultatif)</span>
              )}
            </Label>
            <Select id="acc-group" name="groupId" defaultValue="" required={studentOnly}>
              <option value="">{studentOnly ? "Choisir un groupe…" : "Aucun"}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>
        ) : null}

        <SubmitButton variant="mint" pendingLabel="Création…">
          {studentOnly ? "Ajouter l'étudiant" : "Créer le compte"}
        </SubmitButton>
      </form>

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
