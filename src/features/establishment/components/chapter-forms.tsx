"use client";

import { Check, Pencil, Trash2, X } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage, SubmitButton } from "@/components/ui/form";
import { InlineAction } from "@/components/ui/inline-action";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fieldError, IDLE } from "@/lib/action-state";
import { createChapterAction, deleteChapterAction, updateChapterAction } from "../server/actions";

export function ChapterCreateForm({ moduleId }: { moduleId: string }) {
  const [state, action] = useActionState(createChapterAction, IDLE);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.status === "success") formRef.current?.reset();
  }, [state]);
  const error = fieldError(state, "name");

  return (
    <form ref={formRef} action={action} className="flex flex-col gap-3">
      <FormMessage state={state} />
      <input type="hidden" name="moduleId" value={moduleId} />
      <Label htmlFor="chapter-new">Nouveau chapitre</Label>
      <div className="flex flex-wrap gap-3">
        <Input
          id="chapter-new"
          name="name"
          placeholder="ex. Boucles"
          className="h-11 flex-[1_1_240px]"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "chapter-new-error" : undefined}
          required
        />
        <SubmitButton pendingLabel="Ajout…">Ajouter</SubmitButton>
      </div>
      <FieldError id="chapter-new-error" message={error} />
    </form>
  );
}

interface ChapterRowProps {
  chapter: { id: string; name: string; questionCount: number };
}

/** Ligne de chapitre : renommage en place et suppression. */
export function ChapterRow({ chapter }: ChapterRowProps) {
  const [editing, setEditing] = useState(false);
  const [state, action] = useActionState(updateChapterAction, IDLE);

  // Ferme l'édition après un renommage réussi (ajustement pendant le rendu, sans effet).
  const [lastState, setLastState] = useState(state);
  if (state !== lastState) {
    setLastState(state);
    if (state.status === "success") setEditing(false);
  }

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-line-soft py-3 last:border-b-0">
      {editing ? (
        <form action={action} className="flex flex-[1_1_320px] flex-wrap items-center gap-2">
          <input type="hidden" name="chapterId" value={chapter.id} />
          <Input
            name="name"
            defaultValue={chapter.name}
            aria-label="Nom du chapitre"
            className="h-10 flex-[1_1_200px]"
            autoFocus
            required
          />
          <SubmitButton size="sm" aria-label="Enregistrer">
            <Check aria-hidden />
          </SubmitButton>
          <Button size="sm" variant="ghost" onClick={() => setEditing(false)} aria-label="Annuler">
            <X aria-hidden />
          </Button>
          {state.status === "error" ? (
            <span role="alert" className="w-full text-sm text-danger">
              {fieldError(state, "name") ?? state.message}
            </span>
          ) : null}
        </form>
      ) : (
        <>
          <span className="flex-1 font-semibold">{chapter.name}</span>
          <span className="text-sm text-muted">
            {chapter.questionCount} question{chapter.questionCount > 1 ? "s" : ""}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setEditing(true)}
            aria-label={`Renommer ${chapter.name}`}
          >
            <Pencil aria-hidden />
          </Button>
          <InlineAction
            action={deleteChapterAction}
            fields={{ chapterId: chapter.id }}
            size="sm"
            variant="ghost"
            aria-label={`Supprimer ${chapter.name}`}
            label={<Trash2 aria-hidden />}
            confirmMessage={
              chapter.questionCount > 0
                ? `Supprimer « ${chapter.name} » ? Ses ${chapter.questionCount} questions resteront dans le module, sans chapitre.`
                : `Supprimer le chapitre « ${chapter.name} » ?`
            }
          />
        </>
      )}
    </li>
  );
}
