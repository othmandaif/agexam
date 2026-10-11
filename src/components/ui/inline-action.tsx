"use client";

import { useActionState } from "react";
import { IDLE, type ActionState } from "@/lib/action-state";
import type { ButtonProps } from "./button";
import { ConfirmSubmit } from "./confirm-submit";
import { SubmitButton } from "./form";

type Action = (state: ActionState<unknown>, formData: FormData) => Promise<ActionState<unknown>>;

interface InlineActionProps extends Omit<ButtonProps, "children" | "formAction"> {
  action: Action;
  /** Champs cachés envoyés avec l'action (identifiants…). */
  fields: Record<string, string>;
  label: React.ReactNode;
  /** Si présent, demande une confirmation avant l'envoi. */
  confirmMessage?: string;
}

/**
 * Bouton seul qui déclenche une Server Action (supprimer, retirer, activer…)
 * et affiche l'erreur éventuelle juste à côté.
 */
export function InlineAction({
  action,
  fields,
  label,
  confirmMessage,
  ...buttonProps
}: InlineActionProps) {
  const [state, formAction] = useActionState(action, IDLE);
  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {confirmMessage ? (
        <ConfirmSubmit confirmMessage={confirmMessage} {...buttonProps}>
          {label}
        </ConfirmSubmit>
      ) : (
        <SubmitButton {...buttonProps}>{label}</SubmitButton>
      )}
      {state.status === "error" ? (
        <span role="alert" className="max-w-64 text-right text-xs font-semibold text-danger">
          {state.message}
        </span>
      ) : null}
    </form>
  );
}
