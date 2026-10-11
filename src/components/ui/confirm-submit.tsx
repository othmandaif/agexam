"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";

/**
 * Bouton d'envoi qui demande une confirmation (suppression, désactivation…).
 * À placer dans un <form action={…}>.
 */
export function ConfirmSubmit({
  confirmMessage,
  children,
  ...props
}: ButtonProps & { confirmMessage: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      disabled={pending || props.disabled}
      onClick={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
      {...props}
    >
      {children}
    </Button>
  );
}
