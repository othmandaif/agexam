"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "./button";
import { ConfirmDialog } from "./confirm-dialog";
import { Input } from "./input";

/**
 * Bouton d'envoi qui demande une confirmation dans une fenêtre modale
 * (suppression, désactivation…). À placer dans un <form action={…}>.
 * Avec `confirmWord`, il faut taper ce mot pour pouvoir confirmer.
 */
export function ConfirmSubmit({
  confirmMessage,
  confirmWord,
  children,
  ...props
}: ButtonProps & {
  confirmMessage: string;
  /** Si présent, il faut taper ce mot pour confirmer (ex. « supprimer »). */
  confirmWord?: string;
}) {
  const { pending } = useFormStatus();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const danger = props.variant === "danger";
  const matches = !confirmWord || typed.trim().toLowerCase() === confirmWord.toLowerCase();

  function close() {
    setOpen(false);
    setTyped("");
  }
  function confirm() {
    if (!matches) return;
    close();
    triggerRef.current?.form?.requestSubmit();
  }

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        disabled={pending || props.disabled}
        {...props}
        onClick={() => setOpen(true)}
      >
        {children}
      </Button>
      <ConfirmDialog
        open={open}
        title={danger ? "Confirmer la suppression" : "Confirmer l'action"}
        confirmLabel={danger ? "Supprimer" : "Confirmer"}
        danger={danger}
        confirmDisabled={!matches}
        onConfirm={confirm}
        onCancel={close}
      >
        <p>{confirmMessage}</p>
        {confirmWord ? (
          <label className="mt-3 flex flex-col gap-1.5 text-[13px] font-semibold text-ink">
            <span>
              Pour confirmer, tapez <span className="font-mono text-danger">{confirmWord}</span>
            </span>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  confirm();
                }
              }}
              autoComplete="off"
              autoFocus
              aria-label={`Tapez ${confirmWord} pour confirmer`}
            />
          </label>
        ) : null}
      </ConfirmDialog>
    </>
  );
}
