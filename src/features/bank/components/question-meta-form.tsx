"use client";

import { Archive, ArchiveRestore } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import { DIFFICULTIES, type Difficulty } from "@/domain/enums";
import { useActionRunner } from "@/lib/use-action-runner";
import { DIFFICULTY_LABELS } from "../schemas";
import { archiveQuestionAction, updateQuestionMetaAction } from "../server/actions";

/** Classement (difficulté, chapitre) et archivage d'une question de la banque. */
export function QuestionMetaForm({
  questionId,
  difficulty,
  chapterId,
  chapters,
  archived,
  observed,
}: {
  questionId: string;
  difficulty: Difficulty;
  chapterId: string | null;
  chapters: { id: string; name: string }[];
  archived: boolean;
  observed: Difficulty | null;
}) {
  const [d, setD] = useState<Difficulty>(difficulty);
  const [c, setC] = useState(chapterId ?? "");
  const { state, pending, run } = useActionRunner();
  const dirty = d !== difficulty || (c || null) !== chapterId;

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => updateQuestionMetaAction(questionId, { difficulty: d, chapterId: c || null }));
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Difficulté
          <Select value={d} onChange={(e) => setD(e.target.value as Difficulty)}>
            {DIFFICULTIES.map((x) => (
              <option key={x} value={x}>
                {DIFFICULTY_LABELS[x]}
              </option>
            ))}
          </Select>
        </label>
        {observed && observed !== d ? (
          <p className="-mt-1 text-xs text-muted">
            Les résultats la situent plutôt en «&nbsp;{DIFFICULTY_LABELS[observed].toLowerCase()}
            &nbsp;».{" "}
            <button
              type="button"
              className="font-bold text-primary hover:underline"
              onClick={() => setD(observed)}
            >
              Appliquer
            </button>
          </p>
        ) : null}
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Chapitre
          <Select value={c} onChange={(e) => setC(e.target.value)} disabled={chapters.length === 0}>
            <option value="">{chapters.length ? "Aucun" : "Aucun chapitre dans ce module"}</option>
            {chapters.map((ch) => (
              <option key={ch.id} value={ch.id}>
                {ch.name}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="outline" size="sm" disabled={!dirty || pending}>
          Enregistrer le classement
        </Button>
      </form>
      <div className="border-t border-line-soft pt-3">
        <Button
          variant={archived ? "soft" : "danger"}
          size="sm"
          disabled={pending}
          className="w-full"
          onClick={() => {
            if (
              archived ||
              window.confirm(
                "Archiver cette question ? Elle ne sera plus proposée dans la banque. Les examens qui l'utilisent ne changent pas.",
              )
            ) {
              run(() => archiveQuestionAction(questionId, !archived));
            }
          }}
        >
          {archived ? <ArchiveRestore aria-hidden /> : <Archive aria-hidden />}
          {archived ? "Restaurer dans la banque" : "Archiver"}
        </Button>
      </div>
      <FormMessage state={state} />
    </div>
  );
}
