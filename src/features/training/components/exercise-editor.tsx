"use client";

import { Eye, EyeOff, FlaskConical, Plus, Save, Trash2, X } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { freezeExpected, MAX_TESTS } from "@/domain/agsyntax/testing";
import { AlgoEditor } from "@/features/algo/client/algo-editor";
import { AlgoPlayground } from "@/features/algo/client/algo-playground";
import { IDLE } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { deleteExerciseAction, saveExerciseAction } from "../server/actions";
import { textareaClass } from "./track-forms";

interface TestDraft {
  inputsText: string;
  hidden: boolean;
  /** Sortie figée (enregistrée) ou aperçu calculé. */
  expected?: string;
  error?: string;
}

export interface ExerciseInitial {
  id?: string;
  level: number;
  title: string;
  statement: string;
  starterCode: string;
  solutionCode: string;
  tests: { inputs: string[]; hidden: boolean; expected?: string }[];
}

const toInputs = (text: string) => {
  const lines = text.replace(/\r/g, "").split("\n");
  while (lines.length && lines[lines.length - 1]!.trim() === "") lines.pop();
  return lines;
};

export function ExerciseEditor({
  trackId,
  initial,
  readOnly,
}: {
  trackId: string;
  initial: ExerciseInitial;
  readOnly: boolean;
}) {
  const [state, action, pending] = useActionState(saveExerciseAction, IDLE);
  const [level, setLevel] = useState(String(initial.level));
  const [title, setTitle] = useState(initial.title);
  const [statement, setStatement] = useState(initial.statement);
  const [starter, setStarter] = useState(initial.starterCode);
  const [solution, setSolution] = useState(initial.solutionCode);
  const [tests, setTests] = useState<TestDraft[]>(
    initial.tests.length
      ? initial.tests.map((t) => ({
          inputsText: t.inputs.join("\n"),
          hidden: t.hidden,
          expected: t.expected,
        }))
      : [{ inputsText: "", hidden: false }],
  );

  const patch = (i: number, p: Partial<TestDraft>) =>
    setTests((ts) => ts.map((t, j) => (j === i ? { ...t, ...p } : t)));

  /** Aperçu : exécute le corrigé ici, comme le serveur le fera à l'enregistrement. */
  const preview = () => {
    const cases = tests.map((t) => ({ inputs: toInputs(t.inputsText), hidden: t.hidden }));
    const next: TestDraft[] = tests.map((t) => ({ ...t, expected: undefined, error: undefined }));
    for (let i = 0; i < cases.length; i++) {
      const r = freezeExpected(solution, [cases[i]!]);
      if (r.ok) next[i]!.expected = r.tests[0]!.expected;
      else next[i]!.error = `${r.error.line ? `Ligne ${r.error.line} : ` : ""}${r.error.message}`;
    }
    setTests(next);
  };

  const payload = JSON.stringify({
    exerciseId: initial.id,
    trackId,
    level,
    title,
    statement,
    starterCode: starter,
    solutionCode: solution,
    tests: tests.map((t) => ({ inputs: toInputs(t.inputsText), hidden: t.hidden })),
  });

  return (
    <form action={action} className="flex flex-col gap-6">
      <input type="hidden" name="payload" value={payload} />
      <FormMessage state={state} />

      <Card>
        <CardHeader>
          <CardTitle>Énoncé</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ex-level">Niveau</Label>
              <Input
                id="ex-level"
                type="number"
                min={1}
                max={50}
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                disabled={readOnly}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ex-title">Titre</Label>
              <Input
                id="ex-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex. Somme de deux nombres"
                disabled={readOnly}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ex-statement">Consigne</Label>
            <textarea
              id="ex-statement"
              rows={6}
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              disabled={readOnly}
              className={textareaClass}
              placeholder={
                "Écrire un algorithme qui lit deux entiers a et b puis affiche :\nLa somme est <a + b>"
              }
            />
            <p className="text-[13px] text-muted">
              Précisez le texte exact à afficher : la comparaison ignore seulement les majuscules,
              accents, espaces et la ponctuation. Les messages de saisie (« Entrez a : ») ne sont
              pas comparés.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label>
              Code de départ <span className="font-normal text-muted">(facultatif)</span>
            </Label>
            <AlgoEditor
              value={starter}
              onChange={setStarter}
              readOnly={readOnly}
              minRows={6}
              allowClipboard
              ariaLabel="Code de départ"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Corrigé</CardTitle>
          <CardDescription>
            Jamais montré aux étudiants. Il sert à figer les sorties attendues de chaque jeu
            d&apos;essai.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlgoPlayground
            allowClipboard
            value={solution}
            onChange={setSolution}
            readOnly={readOnly}
            minRows={12}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Jeux d&apos;essai</CardTitle>
            <CardDescription>
              Une valeur par ligne, dans l&apos;ordre des LIRE. Un jeu caché n&apos;affiche que
              réussi / échoué à l&apos;étudiant.
            </CardDescription>
          </div>
          <Button variant="soft" size="sm" onClick={preview}>
            <FlaskConical aria-hidden /> Calculer les sorties
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {tests.map((t, i) => (
            <div
              key={i}
              className="grid gap-3 rounded-[12px] border border-line bg-canvas/60 p-3.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]"
            >
              <div className="flex flex-col gap-1.5">
                <span className="text-[12.5px] font-bold text-muted">Jeu {i + 1} · saisies</span>
                <textarea
                  rows={Math.max(2, t.inputsText.split("\n").length)}
                  value={t.inputsText}
                  onChange={(e) =>
                    patch(i, { inputsText: e.target.value, expected: undefined, error: undefined })
                  }
                  disabled={readOnly}
                  aria-label={`Saisies du jeu ${i + 1}`}
                  placeholder={"12\n5"}
                  className={cn(textareaClass, "font-mono text-[13.5px]")}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-[12.5px] font-bold text-muted">Sortie attendue</span>
                {t.error ? (
                  <p className="rounded-field bg-danger-bg px-3 py-2 text-[13px] font-semibold text-danger">
                    {t.error}
                  </p>
                ) : t.expected !== undefined ? (
                  <pre className="m-0 max-h-40 overflow-auto rounded-field bg-[#0f172a] px-3 py-2 font-mono text-[12.5px] whitespace-pre-wrap text-[#e2e8f0]">
                    {t.expected || "(aucune sortie)"}
                  </pre>
                ) : (
                  <p className="rounded-field border border-dashed border-line px-3 py-2 text-[13px] text-muted">
                    Calculée depuis le corrigé à l&apos;enregistrement.
                  </p>
                )}
              </div>
              <div className="flex items-start gap-1.5 md:flex-col">
                <Button
                  variant={t.hidden ? "soft" : "outline"}
                  size="sm"
                  onClick={() => patch(i, { hidden: !t.hidden })}
                  disabled={readOnly}
                  aria-pressed={t.hidden}
                  title="Jeu caché"
                >
                  {t.hidden ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
                  {t.hidden ? "Caché" : "Visible"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setTests((ts) => ts.filter((_, j) => j !== i))}
                  disabled={readOnly || tests.length === 1}
                  aria-label={`Retirer le jeu ${i + 1}`}
                >
                  <X aria-hidden />
                </Button>
              </div>
            </div>
          ))}
          {readOnly ? null : (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              disabled={tests.length >= MAX_TESTS}
              onClick={() => setTests((ts) => [...ts, { inputsText: "", hidden: true }])}
            >
              <Plus aria-hidden /> Ajouter un jeu d&apos;essai
            </Button>
          )}
        </CardContent>
      </Card>

      {readOnly ? null : (
        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-end gap-3 rounded-[14px] border border-line bg-surface/95 p-3 shadow-pop backdrop-blur">
          <span className="mr-auto text-[13px] text-muted max-sm:hidden">
            À l&apos;enregistrement, le corrigé est exécuté sur chaque jeu et les sorties sont
            figées.
          </span>
          <Button type="submit" variant="mint" disabled={pending}>
            <Save aria-hidden /> {pending ? "Enregistrement…" : "Enregistrer l'exercice"}
          </Button>
        </div>
      )}
    </form>
  );
}

export function DeleteExerciseButton({ exerciseId, title }: { exerciseId: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteExerciseAction, IDLE);
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
        title="Supprimer cet exercice ?"
        confirmLabel="Supprimer"
        pending={pending}
        onCancel={() => setOpen(false)}
        onConfirm={() =>
          start(() => {
            const fd = new FormData();
            fd.set("exerciseId", exerciseId);
            action(fd);
          })
        }
      >
        « {title} » et les soumissions des étudiants pour cet exercice seront supprimés.
      </ConfirmDialog>
    </>
  );
}
