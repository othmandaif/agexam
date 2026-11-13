"use client";

import {
  CircleAlert,
  CircleCheck,
  CircleX,
  Download,
  EyeOff,
  FileText,
  Lightbulb,
  Upload,
} from "lucide-react";
import { useActionState, useDeferredValue, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { freezeExpected } from "@/domain/agsyntax/testing";
import { traceAlgorithm } from "@/domain/agsyntax/trace";
import { TracePlayer } from "@/features/homework/components/trace-player";
import { IDLE } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { importExercisesAction } from "../server/actions";
import { EXERCISES_TEMPLATE, HOMEWORK_TEMPLATE, parseExercisesText } from "../text";
import { textareaClass } from "./track-forms";

/** Import de plusieurs exercices d'un coup, depuis un texte au format modèle. */
export function ExerciseImport({
  trackId,
  importAction = importExercisesAction,
  homework = false,
}: {
  trackId: string;
  /** Devoirs à distance : import des étapes (numérotées dans l'ordre du texte). */
  importAction?: typeof importExercisesAction;
  homework?: boolean;
}) {
  const template = homework ? HOMEWORK_TEMPLATE : EXERCISES_TEMPLATE;
  const noun = homework ? "étape" : "exercice";
  const [text, setText] = useState("");
  const deferred = useDeferredValue(text);
  const parsed = useMemo(() => parseExercisesText(deferred), [deferred]);
  const [state, action, pending] = useActionState(importAction, IDLE);
  // Validation de chaque étape : le corrigé est exécuté sur chaque jeu d'essai.
  const checks = useMemo(
    () =>
      parsed.exercises.map((e) =>
        e.errors.length
          ? []
          : e.tests.map((t) => {
              const r = freezeExpected(e.solutionCode, [t]);
              return r.ok
                ? { ok: true as const, expected: r.tests[0]!.expected }
                : {
                    ok: false as const,
                    error: `${r.error.line ? `ligne ${r.error.line} du corrigé : ` : ""}${r.error.message}`,
                  };
            }),
      ),
    [parsed],
  );
  const failing = checks.reduce((s, c) => s + c.filter((x) => !x.ok).length, 0);
  const errorCount =
    parsed.globalErrors.length +
    parsed.exercises.reduce((s, e) => s + e.errors.length, 0) +
    failing;
  const ready = parsed.exercises.length > 0 && errorCount === 0;

  const download = () => {
    const url = URL.createObjectURL(new Blob([template], { type: "text/plain" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = homework ? "modele-devoir-etapes.txt" : "modele-exercices-agsyntax.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFile = async (file: File | undefined) => {
    if (file) setText(await file.text());
  };

  return (
    <form
      action={action}
      className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
    >
      <input type="hidden" name="trackId" value={trackId} />
      <input type="hidden" name="text" value={text} />
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="soft" size="sm" onClick={() => setText(template)}>
            <FileText aria-hidden /> Insérer le modèle
          </Button>
          <Button variant="outline" size="sm" onClick={download}>
            <Download aria-hidden /> Télécharger le modèle (.txt)
          </Button>
          <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[12px] border border-[#e2e8f0] bg-surface px-3.5 text-[13px] font-semibold hover:bg-[#f8fafc]">
            <Upload className="size-[18px]" aria-hidden /> Ouvrir un fichier .txt
            <input
              type="file"
              accept=".txt,text/plain"
              className="sr-only"
              onChange={(e) => void onFile(e.target.files?.[0])}
            />
          </label>
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={28}
          spellCheck={false}
          aria-label={homework ? "Étapes au format texte" : "Exercices au format texte"}
          placeholder={
            homework
              ? "ETAPE: Lire les données\nÉnoncé…\n```solution\n…\n```\nTEST: 12 ; 15 ; 9\nTEST CACHE: 0 ; 20 ; 10"
              : "EXERCICE: Titre\nNIVEAU: 1\nÉnoncé…\n```solution\n…\n```\nTEST: 2 ; 3\nTEST CACHE: 10 ; -4"
          }
          className={cn(textareaClass, "font-mono text-[13px] leading-[20px]")}
        />
        <details className="rounded-xl border border-line bg-canvas px-4 py-3 text-sm text-ink-soft">
          <summary className="cursor-pointer font-bold">Format</summary>
          <ul className="mt-2 flex list-disc flex-col gap-1 pl-5">
            {homework ? (
              <li>
                <code>ETAPE: titre</code> commence une étape. Les étapes sont numérotées dans
                l&apos;ordre du texte (à la suite des étapes existantes). Conseil : 1. analyser les
                entrées / sorties, 2. lire les données, 3. calculer, 4. algorithme complet.
              </li>
            ) : (
              <li>
                <code>EXERCICE: titre</code> commence un exercice, <code>NIVEAU: 2</code> (sinon le
                niveau précédent).
              </li>
            )}
            <li>Les lignes suivantes forment l&apos;énoncé (précisez le texte à afficher).</li>
            <li>
              Code de départ facultatif entre <code>```depart</code> et <code>```</code> ; corrigé
              entre <code>```solution</code> et <code>```</code>
              {homework ? " (il sert aussi à l'indice animé de l'étape)" : ""}.
            </li>
            {homework ? (
              <li>
                Indice animé facultatif entre <code>```indice</code> et <code>```</code> (sinon le
                corrigé est animé). Les commentaires <code>{"// …"}</code> en fin de ligne
                deviennent les explications de chaque pas. <code>INDICE SAISIES: 4 ; 6</code>{" "}
                choisit les saisies de l&apos;animation.
              </li>
            ) : null}
            <li>
              <code>TEST: 2 ; 3</code> = jeu visible (saisies des LIRE séparées par « ; »),{" "}
              <code>TEST CACHE: …</code> = jeu caché.
            </li>
            <li>Les sorties attendues sont calculées depuis le corrigé à l&apos;import.</li>
          </ul>
        </details>
      </div>

      <div className="flex flex-col gap-3 lg:sticky lg:top-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-muted">
            {parsed.exercises.length} {noun}
            {parsed.exercises.length > 1 ? "s" : ""} ·{" "}
            {errorCount === 0 ? (
              <span className="text-success">prêt</span>
            ) : (
              <span className="text-danger">
                {errorCount} erreur{errorCount > 1 ? "s" : ""}
              </span>
            )}
          </p>
          <Button type="submit" variant="mint" disabled={!ready || pending}>
            <Upload aria-hidden />
            {pending
              ? "Import…"
              : `Importer ${parsed.exercises.length || ""} ${noun}${parsed.exercises.length > 1 ? "s" : ""}`}
          </Button>
        </div>
        <FormMessage state={state} />
        {parsed.globalErrors.map((e) => (
          <p
            key={e}
            className="rounded-field bg-danger-bg px-3 py-2 text-sm font-semibold text-danger"
          >
            {e}
          </p>
        ))}
        <div className="flex max-h-[70vh] flex-col gap-2.5 overflow-auto pr-1">
          {parsed.exercises.length === 0 ? (
            <p className="rounded-card border border-dashed border-line px-4 py-10 text-center text-sm text-muted">
              Collez vos {noun}s ou insérez le modèle : l&apos;aperçu s&apos;affiche ici.
            </p>
          ) : (
            parsed.exercises.map((e, idx) => (
              <article
                key={`${e.number}-${e.line}`}
                className={cn(
                  "flex flex-col gap-2 rounded-card border bg-surface p-4",
                  e.errors.length ? "border-danger-fill/60" : "border-line",
                )}
              >
                <header className="flex flex-wrap items-center gap-2">
                  {e.errors.length ? (
                    <CircleAlert className="size-4 text-danger" aria-hidden />
                  ) : (
                    <CircleCheck className="size-4 text-success" aria-hidden />
                  )}
                  <span className="font-bold">{e.title || "(sans titre)"}</span>
                  <Badge tone="info">{homework ? `Étape ${idx + 1}` : `Niveau ${e.level}`}</Badge>
                  <span className="ml-auto flex items-center gap-1 text-xs text-muted">
                    {e.tests.length} jeu{e.tests.length > 1 ? "x" : ""}
                    {e.tests.some((t) => t.hidden) ? (
                      <>
                        {" "}
                        · <EyeOff className="size-3" aria-hidden />{" "}
                        {e.tests.filter((t) => t.hidden).length}
                      </>
                    ) : null}
                  </span>
                </header>
                {e.statement ? (
                  <p className="line-clamp-3 text-sm whitespace-pre-line text-ink-soft">
                    {e.statement}
                  </p>
                ) : null}
                {e.errors.map((err) => (
                  <p
                    key={err}
                    className="flex items-start gap-1.5 rounded-field bg-danger-bg px-3 py-2 text-sm font-semibold text-danger"
                  >
                    <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {err}
                  </p>
                ))}
                {checks[idx]?.length ? (
                  <ul className="flex flex-col gap-1">
                    {checks[idx]!.map((c, k) => (
                      <li
                        key={k}
                        className={cn(
                          "flex items-start gap-2 rounded-field px-2.5 py-1.5 text-[12.5px]",
                          c.ok
                            ? "bg-canvas text-ink-soft"
                            : "bg-danger-bg font-semibold text-danger",
                        )}
                      >
                        {c.ok ? (
                          <CircleCheck
                            className="mt-0.5 size-3.5 shrink-0 text-success"
                            aria-hidden
                          />
                        ) : (
                          <CircleX className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        )}
                        <span className="font-semibold whitespace-nowrap">
                          Jeu {k + 1}
                          {e.tests[k]!.hidden ? " (caché)" : ""}
                          {e.tests[k]!.inputs.length ? ` · ${e.tests[k]!.inputs.join(" ; ")}` : ""}
                        </span>
                        <span className="min-w-0 truncate font-mono">
                          {c.ok
                            ? `→ ${c.expected.replace(/\n/g, " ⏎ ") || "(aucune sortie)"}`
                            : c.error}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {homework && !e.errors.length ? <HintPreview exercise={e} /> : null}
              </article>
            ))
          )}
        </div>
      </div>
    </form>
  );
}

/** Aperçu de l'indice animé d'une étape importée (code « indice » ou corrigé). */
function HintPreview({
  exercise,
}: {
  exercise: {
    solutionCode: string;
    hintCode: string;
    hintInputs: string[] | null;
    tests: { inputs: string[]; hidden: boolean }[];
  };
}) {
  const [open, setOpen] = useState(false);
  const code = exercise.hintCode.trim() ? exercise.hintCode : exercise.solutionCode;
  const inputs =
    exercise.hintInputs ??
    (exercise.tests.find((t) => !t.hidden) ?? exercise.tests[0])?.inputs ??
    [];
  const inputsKey = JSON.stringify(inputs);
  const trace = useMemo(
    () => (open ? traceAlgorithm(code, JSON.parse(inputsKey) as string[], 300) : null),
    [open, code, inputsKey],
  );

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Lightbulb className="text-[#d99a00]" aria-hidden />
        {open ? "Masquer l'indice" : "Voir l'indice animé"}
        <span className="font-normal text-muted">
          ({exercise.hintCode.trim() ? "code indice" : "corrigé"})
        </span>
      </Button>
      {open && trace ? (
        trace.error && trace.frames.length === 0 ? (
          <p className="rounded-field bg-danger-bg px-3 py-2 text-sm font-semibold text-danger">
            Indice : {trace.error.message}
          </p>
        ) : (
          <TracePlayer
            code={code}
            frames={trace.frames}
            inputs={inputs}
            truncated={trace.truncated}
          />
        )
      ) : null}
    </div>
  );
}
