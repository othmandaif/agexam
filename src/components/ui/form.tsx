"use client";

import { CircleAlert, CircleCheck } from "lucide-react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "./button";

/** Bouton d'envoi désactivé pendant l'exécution de la Server Action. */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || props.disabled} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

/** Message global de succès ou d'erreur d'un formulaire. */
export function FormMessage({
  state,
  className,
}: {
  state: ActionState<unknown>;
  className?: string;
}) {
  if (state.status === "idle") return null;
  if (state.status === "success" && !state.message) return null;
  const isError = state.status === "error";
  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-xl px-4 py-3 text-sm font-semibold",
        isError ? "bg-danger-bg text-danger" : "bg-success-bg text-success",
        className,
      )}
    >
      {isError ? (
        <CircleAlert className="mt-px size-4 shrink-0" aria-hidden />
      ) : (
        <CircleCheck className="mt-px size-4 shrink-0" aria-hidden />
      )}
      {state.message}
    </p>
  );
}

/** Message d'erreur sous un champ. */
export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="text-sm text-danger">
      {message}
    </p>
  );
}
