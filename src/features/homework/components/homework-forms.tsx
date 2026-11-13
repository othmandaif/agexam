"use client";

import { CalendarClock, Eye, EyeOff, Send, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError, FormMessage, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { textareaClass } from "@/features/training/components/track-forms";
import { fieldError, IDLE } from "@/lib/action-state";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import {
  createHomeworkAction,
  deleteHomeworkAction,
  handInHomeworkAction,
  updateHomeworkAction,
} from "../server/actions";

/** Date limite saisie en heure locale, envoyée en ISO (UTC). */
function DueField({
  id,
  initial,
  disabled,
}: {
  id: string;
  initial?: string | null;
  disabled?: boolean;
}) {
  const [local, setLocal] = useState(toLocalInputValue(initial));
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>
        Date limite <span className="font-normal text-muted">(facultatif)</span>
      </Label>
      <Input
        id={id}
        type="datetime-local"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        disabled={disabled}
      />
      <input type="hidden" name="dueAt" value={fromLocalInputValue(local)} />
    </div>
  );
}

export function HomeworkCreateForm() {
  const [state, action] = useActionState(createHomeworkAction, IDLE);
  const titleError = fieldError(state, "title");
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="hw-title">Titre du devoir</Label>
        <Input
          id="hw-title"
          name="title"
          placeholder="Ex. Moyenne de trois notes"
          required
          aria-invalid={titleError ? true : undefined}
        />
        <FieldError id="hw-title-error" message={titleError} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="hw-session">Séance</Label>
        <Input id="hw-session" name="sessionLabel" placeholder="Ex. Séance du 14/11 — conditions" />
      </div>
      <DueField id="hw-due" />
      <div className="flex flex-col gap-2">
        <Label htmlFor="hw-desc">
          Consignes générales <span className="font-normal text-muted">(facultatif)</span>
        </Label>
        <textarea
          id="hw-desc"
          name="description"
          rows={3}
          className={textareaClass}
          placeholder="Le problème à résoudre, ce que le stagiaire doit rendre."
        />
      </div>
      <SubmitButton variant="mint" pendingLabel="Création…">
        Créer le devoir
      </SubmitButton>
    </form>
  );
}

export function HomeworkSettingsForm({
  homework,
  groups,
  selectedGroupIds,
  readOnly,
}: {
  homework: {
    id: string;
    title: string;
    sessionLabel: string | null;
    description: string | null;
    dueAt: string | null;
    isPublished: boolean;
  };
  groups: { id: string; name: string; label: string | null }[];
  selectedGroupIds: string[];
  readOnly: boolean;
}) {
  const [state, action] = useActionState(updateHomeworkAction, IDLE);
  const [published, setPublished] = useState(homework.isPublished);
  const [selected, setSelected] = useState(new Set(selectedGroupIds));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <form action={action} className="flex flex-col gap-5">
      <FormMessage state={state} />
      <input type="hidden" name="homeworkId" value={homework.id} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="hs-title">Titre</Label>
        <Input
          id="hs-title"
          name="title"
          defaultValue={homework.title}
          disabled={readOnly}
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="hs-session">Séance</Label>
        <Input
          id="hs-session"
          name="sessionLabel"
          defaultValue={homework.sessionLabel ?? ""}
          disabled={readOnly}
        />
      </div>
      <DueField id="hs-due" initial={homework.dueAt} disabled={readOnly} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="hs-desc">Consignes générales</Label>
        <textarea
          id="hs-desc"
          name="description"
          rows={3}
          defaultValue={homework.description ?? ""}
          disabled={readOnly}
          className={textareaClass}
        />
      </div>
      <fieldset className="flex flex-col gap-2" disabled={readOnly}>
        <legend className="mb-2 text-sm font-bold text-ink">Groupes concernés</legend>
        {groups.length === 0 ? (
          <p className="text-sm text-muted">Aucun groupe pour l&apos;année en cours.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {groups.map((g) => {
              const on = selected.has(g.id);
              return (
                <label
                  key={g.id}
                  title={g.label ?? undefined}
                  className={cn(
                    "flex h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-[13px] font-semibold transition-colors select-none",
                    on
                      ? "border-primary bg-primary-wash text-primary"
                      : "border-line bg-surface text-muted hover:border-[#cbd5e1]",
                  )}
                >
                  <input
                    type="checkbox"
                    name="groupId"
                    value={g.id}
                    checked={on}
                    onChange={() => toggle(g.id)}
                    className="size-3.5 accent-[#315bef]"
                  />
                  {g.name}
                </label>
              );
            })}
          </div>
        )}
      </fieldset>
      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-[12px] border p-3.5 transition-colors",
          published ? "border-success/40 bg-success-bg" : "border-line bg-canvas",
        )}
      >
        <input
          type="checkbox"
          name="isPublished"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
          disabled={readOnly}
          className="mt-0.5 size-4 accent-[#16a34a]"
        />
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
            {published ? (
              <Eye className="size-4" aria-hidden />
            ) : (
              <EyeOff className="size-4" aria-hidden />
            )}
            {published ? "Publié" : "Brouillon"}
          </span>
          <span className="text-[13px] text-muted">
            Publié : les stagiaires des groupes choisis le voient dans « Devoirs ».
          </span>
        </span>
      </label>
      {readOnly ? null : <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>}
    </form>
  );
}

export function DeleteHomeworkButton({ homeworkId, title }: { homeworkId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteHomeworkAction, IDLE);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden /> Supprimer
      </Button>
      {state.status === "error" ? <FormMessage state={state} /> : null}
      <ConfirmDialog
        open={open}
        danger
        title="Supprimer ce devoir ?"
        confirmLabel="Supprimer définitivement"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(() => {
            const fd = new FormData();
            fd.set("homeworkId", homeworkId);
            action(fd);
          })
        }
      >
        « {title} », ses étapes, les soumissions et les rendus des stagiaires seront supprimés.
        Cette action est irréversible.
      </ConfirmDialog>
    </>
  );
}

/** Rendu final (stagiaire) : algorithme complet + trace, après la dernière étape. */
export function HandInButton({
  homeworkId,
  ready,
  handedIn,
  late,
}: {
  homeworkId: string;
  ready: boolean;
  handedIn: boolean;
  late: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(handInHomeworkAction, IDLE);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-2">
      <Button variant="mint" size="lg" onClick={() => setOpen(true)} disabled={!ready || pending}>
        <Send aria-hidden /> {handedIn ? "Rendre à nouveau" : "Rendre le devoir"}
      </Button>
      {!ready ? (
        <p className="text-[13px] text-muted">Réussissez toutes les étapes pour pouvoir rendre.</p>
      ) : late ? (
        <p className="flex items-center gap-1.5 text-[13px] font-semibold text-warning">
          <CalendarClock className="size-4" aria-hidden /> La date limite est passée : le rendu sera
          marqué en retard.
        </p>
      ) : null}
      <FormMessage state={state} />
      <ConfirmDialog
        open={open}
        title="Rendre ce devoir ?"
        confirmLabel="Rendre"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(() => {
            setOpen(false);
            const fd = new FormData();
            fd.set("homeworkId", homeworkId);
            action(fd);
          })
        }
      >
        Votre algorithme complet (dernière étape réussie) et sa trace d&apos;exécution seront
        envoyés à votre formateur.
      </ConfirmDialog>
    </div>
  );
}
