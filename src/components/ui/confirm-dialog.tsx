"use client";

import { AlertTriangle } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "./button";

/**
 * Fenêtre de confirmation (dialog natif : focus piégé, Échap pour annuler).
 * Ouverte tant que `open` est vrai.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger = false,
  pending = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  danger?: boolean;
  pending?: boolean;
  /** Bouton de confirmation bloqué (ex. saisie de vérification incomplète). */
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!pending) onCancel();
      }}
      className="m-auto w-[min(460px,calc(100vw-32px))] rounded-panel border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-[#0d2148]/45"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start gap-3">
          <span
            className={
              danger
                ? "flex size-10 shrink-0 items-center justify-center rounded-full bg-danger-bg text-danger"
                : "flex size-10 shrink-0 items-center justify-center rounded-full bg-lilac text-primary"
            }
            aria-hidden
          >
            <AlertTriangle className="size-5" />
          </span>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-[17px] font-bold">{title}</h2>
            <div className="text-[14px] text-muted">{children}</div>
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={pending} autoFocus>
            Annuler
          </Button>
          <Button
            variant={danger ? "danger" : "mint"}
            size="sm"
            onClick={onConfirm}
            disabled={pending || confirmDisabled}
            className={danger ? "border-danger-fill bg-danger-fill text-white hover:bg-danger" : ""}
          >
            {pending ? "Patientez…" : confirmLabel}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
