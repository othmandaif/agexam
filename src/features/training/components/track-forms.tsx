"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FieldError, FormMessage, SubmitButton } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldError, IDLE } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { createTrackAction, deleteTrackAction, updateTrackAction } from "../server/actions";

export const textareaClass =
  "w-full rounded-field border border-[#e2e8f0] bg-surface px-3.5 py-2.5 text-[15px] text-ink transition-shadow focus:border-primary focus:shadow-[0_0_0_3px_rgba(49,91,239,0.15)] focus:outline-none aria-invalid:border-danger-fill";

export function TrackCreateForm() {
  const [state, action] = useActionState(createTrackAction, IDLE);
  const titleError = fieldError(state, "title");
  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="track-title">Titre du parcours</Label>
        <Input
          id="track-title"
          name="title"
          placeholder="Ex. Les boucles POUR et TANT QUE"
          required
          aria-invalid={titleError ? true : undefined}
        />
        <FieldError id="track-title-error" message={titleError} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="track-desc">
          Description <span className="font-normal text-muted">(facultatif)</span>
        </Label>
        <textarea
          id="track-desc"
          name="description"
          rows={3}
          className={textareaClass}
          placeholder="Ce que l'étudiant va travailler."
        />
      </div>
      <SubmitButton variant="mint" pendingLabel="Création…">
        Créer le parcours
      </SubmitButton>
    </form>
  );
}

export function TrackSettingsForm({
  track,
  groups,
  selectedGroupIds,
  readOnly,
}: {
  track: { id: string; title: string; description: string | null; isPublished: boolean };
  groups: { id: string; name: string; label: string | null }[];
  selectedGroupIds: string[];
  readOnly: boolean;
}) {
  const [state, action] = useActionState(updateTrackAction, IDLE);
  const [published, setPublished] = useState(track.isPublished);
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
      <input type="hidden" name="trackId" value={track.id} />
      <div className="flex flex-col gap-2">
        <Label htmlFor="ts-title">Titre</Label>
        <Input id="ts-title" name="title" defaultValue={track.title} disabled={readOnly} required />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="ts-desc">Description</Label>
        <textarea
          id="ts-desc"
          name="description"
          rows={3}
          defaultValue={track.description ?? ""}
          disabled={readOnly}
          className={textareaClass}
        />
      </div>
      <fieldset className="flex flex-col gap-2" disabled={readOnly}>
        <legend className="mb-2 text-sm font-bold text-ink">Groupes qui voient ce parcours</legend>
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
            Publié : les étudiants des groupes choisis le voient dans « Entraînement ».
          </span>
        </span>
      </label>
      {readOnly ? null : <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>}
    </form>
  );
}

export function DeleteTrackButton({ trackId, title }: { trackId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteTrackAction, IDLE);
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
        title="Supprimer ce parcours ?"
        confirmLabel="Supprimer définitivement"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(() => {
            const fd = new FormData();
            fd.set("trackId", trackId);
            action(fd);
          })
        }
      >
        « {title} », ses exercices et toutes les soumissions des étudiants seront supprimés. Cette
        action est irréversible.
      </ConfirmDialog>
    </>
  );
}
