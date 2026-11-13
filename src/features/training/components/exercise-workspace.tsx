"use client";

import {
  ArrowRight,
  CheckCircle2,
  CircleX,
  EyeOff,
  PartyPopper,
  RotateCcw,
  Send,
  Unlock,
} from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormMessage } from "@/components/ui/form";
import { AlgoPlayground } from "@/features/algo/client/algo-playground";
import { IDLE, type ActionState } from "@/lib/action-state";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";
import type { AlgoTestResult } from "@/server/db/schema/training";
import { submitExerciseAction, type SubmissionView } from "../server/actions";

const draftKey = (id: string) => `agexam_algo_${id}`;

export function ExerciseWorkspace({
  exerciseId,
  initialCode,
  starterCode,
  lastResult,
  next,
  submitAction = submitExerciseAction,
  nextHref,
  labels = WORDING,
  extra,
}: {
  exerciseId: string;
  initialCode: string;
  starterCode: string;
  lastResult: Omit<SubmissionView, "justUnlocked" | "xpGained"> | null;
  next: { id: string; title: string } | null;
  /** Devoirs à distance : soumission d'une étape. */
  submitAction?: typeof submitExerciseAction;
  /** Lien vers la suite (par défaut : exercice suivant). */
  nextHref?: Route;
  labels?: Partial<typeof WORDING>;
  /** Zone affichée sous les résultats (ex. indice animé). */
  extra?: ReactNode;
}) {
  const [code, setCode] = useState(initialCode);
  const [confirm, setConfirm] = useState(false);
  const [emptyError, setEmptyError] = useState(false);
  const [state, action] = useActionState<ActionState<SubmissionView>, FormData>(submitAction, IDLE);
  const words = { ...WORDING, ...labels };
  const [pending, start] = useTransition();

  // Brouillon local : un rechargement ne fait rien perdre.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey(exerciseId));
      // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture du brouillon après hydratation
      if (saved && saved !== initialCode) setCode(saved);
    } catch {
      /* stockage indisponible */
    }
  }, [exerciseId, initialCode]);
  const change = (v: string) => {
    setCode(v);
    try {
      localStorage.setItem(draftKey(exerciseId), v);
    } catch {
      /* stockage indisponible */
    }
  };

  const submit = () =>
    start(() => {
      setConfirm(false);
      const fd = new FormData();
      fd.set("exerciseId", exerciseId);
      fd.set("code", code);
      action(fd);
    });

  const result = state.status === "success" && state.data ? state.data : null;
  const shown = result ?? (state.status === "idle" ? lastResult : null);

  return (
    <div className="flex flex-col gap-5">
      <AlgoPlayground
        value={code}
        onChange={change}
        minRows={16}
        actions={
          <>
            <Button
              variant="mint"
              onClick={() => {
                // Éditeur vide : message clair plutôt qu'une erreur de formulaire.
                if (!code.trim()) return setEmptyError(true);
                setEmptyError(false);
                setConfirm(true);
              }}
              disabled={pending}
            >
              <Send aria-hidden /> {pending ? "Vérification…" : "Soumettre"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => change(starterCode)}
              title="Revenir au code de départ"
            >
              <RotateCcw aria-hidden /> Réinitialiser
            </Button>
          </>
        }
      />

      {emptyError ? (
        <p
          role="alert"
          className="rounded-xl bg-warning-bg px-4 py-3 text-sm font-semibold text-warning"
        >
          Écrivez votre algorithme dans l&apos;éditeur avant de soumettre.
        </p>
      ) : state.status === "error" ? (
        <FormMessage state={state} />
      ) : null}
      {shown ? (
        <Results
          view={shown}
          fresh={!!result}
          justUnlocked={result?.justUnlocked ?? false}
          xpGained={result?.xpGained ?? 0}
          next={next}
          nextHref={nextHref}
          words={words}
        />
      ) : null}
      {extra}

      <ConfirmDialog
        open={confirm}
        title="Soumettre votre algorithme ?"
        confirmLabel="Soumettre"
        pending={pending}
        onCancel={() => setConfirm(false)}
        onConfirm={submit}
      >
        Tous les jeux d&apos;essai vont être exécutés, y compris les jeux cachés. Vous pourrez
        corriger et soumettre à nouveau.
      </ConfirmDialog>
    </div>
  );
}

const WORDING = {
  solved: "Exercice réussi !",
  unlocked: "Niveau suivant débloqué",
  next: "Exercice suivant",
};

function Results({
  view,
  fresh,
  justUnlocked,
  xpGained,
  next,
  nextHref,
  words,
}: {
  view: Omit<SubmissionView, "justUnlocked" | "xpGained">;
  fresh: boolean;
  justUnlocked: boolean;
  xpGained: number;
  next: { id: string; title: string } | null;
  nextHref?: Route;
  words: typeof WORDING;
}) {
  const pct = view.totalCount ? Math.round((view.passedCount / view.totalCount) * 100) : 0;
  return (
    <section
      aria-label="Résultat de la soumission"
      aria-live="polite"
      className={cn(
        "flex flex-col gap-4 rounded-card border p-5",
        view.passed ? "border-success/30 bg-success-bg/60" : "border-line bg-surface",
        fresh && "animate-fade-in",
      )}
    >
      <div className="flex flex-wrap items-center gap-4">
        <span
          className={cn(
            "flex size-12 items-center justify-center rounded-full",
            view.passed ? "bg-success text-white" : "bg-warning-bg text-warning",
          )}
        >
          {view.passed ? (
            <PartyPopper className="size-6" aria-hidden />
          ) : (
            <span className="text-[15px] font-bold">{pct}%</span>
          )}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-[17px] font-bold text-ink">
            {view.passed ? words.solved : "Pas encore…"}
          </p>
          <p className="text-[14px] text-muted">
            {view.passedCount} / {view.totalCount} jeux d&apos;essai réussis
            {fresh ? "" : " (dernière soumission)"}
          </p>
          {xpGained > 0 ? (
            <p className="mt-1 inline-flex w-fit animate-bounce items-center gap-1.5 rounded-full bg-[#fff6dc] px-3 py-1 text-[14px] font-extrabold text-[#9a6b00] motion-reduce:animate-none">
              ⭐ +{xpGained} XP{xpGained % 10 === 5 ? " (bonus du premier coup)" : ""}
            </p>
          ) : null}
          {justUnlocked ? (
            <p className="mt-1 flex items-center gap-1.5 text-[14px] font-semibold text-success">
              <Unlock className="size-4" aria-hidden /> {words.unlocked}
            </p>
          ) : null}
        </div>
        {view.passed && next ? (
          <Link
            href={nextHref ?? paths.studentExercise(next.id)}
            className={buttonVariants({ variant: "mint" })}
          >
            {words.next} <ArrowRight aria-hidden />
          </Link>
        ) : null}
      </div>

      <ol className="flex flex-col gap-2">
        {view.results.map((r, i) => (
          <TestRow key={i} index={i} result={r} />
        ))}
      </ol>
    </section>
  );
}

function TestRow({ index, result }: { index: number; result: AlgoTestResult }) {
  const [open, setOpen] = useState(!result.passed && !result.hidden);
  const icon = result.passed ? (
    <CheckCircle2 className="size-4.5 shrink-0 text-success" aria-hidden />
  ) : (
    <CircleX className="size-4.5 shrink-0 text-danger" aria-hidden />
  );
  if (result.hidden) {
    return (
      <li className="flex items-center gap-2.5 rounded-[10px] border border-line-soft bg-surface px-3.5 py-2.5 text-[14px]">
        {icon}
        <span className="font-semibold">Jeu {index + 1}</span>
        <span className="flex items-center gap-1 text-[12.5px] text-muted">
          <EyeOff className="size-3.5" aria-hidden /> caché
        </span>
        <span
          className={cn(
            "ml-auto text-[13px] font-semibold",
            result.passed ? "text-success" : "text-danger",
          )}
        >
          {result.passed ? "Réussi" : "Échoué"}
        </span>
      </li>
    );
  }
  return (
    <li className="rounded-[10px] border border-line-soft bg-surface text-[14px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
      >
        {icon}
        <span className="font-semibold">Jeu {index + 1}</span>
        <span className="truncate font-mono text-[12.5px] text-muted">
          {result.inputs?.length ? `saisies : ${result.inputs.join(" · ")}` : "sans saisie"}
        </span>
        <span
          className={cn(
            "ml-auto text-[13px] font-semibold",
            result.passed ? "text-success" : "text-danger",
          )}
        >
          {result.passed ? "Réussi" : "Échoué"}
        </span>
      </button>
      {open ? (
        <div className="grid gap-3 border-t border-line-soft p-3.5 md:grid-cols-2">
          <OutputBox label="Sortie attendue" text={result.expected ?? ""} />
          <OutputBox
            label="Votre sortie"
            text={result.got ?? ""}
            tone={result.passed ? "ok" : "bad"}
          />
          {result.error ? (
            <p className="rounded-field bg-danger-bg px-3 py-2 text-[13px] font-semibold text-danger md:col-span-2">
              {result.error}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

function OutputBox({ label, text, tone }: { label: string; text: string; tone?: "ok" | "bad" }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[12.5px] font-bold text-muted">{label}</span>
      <pre
        className={cn(
          "m-0 max-h-48 overflow-auto rounded-field border bg-[#0f172a] px-3 py-2 font-mono text-[12.5px] whitespace-pre-wrap text-[#e2e8f0]",
          tone === "bad" ? "border-danger-fill/60" : "border-transparent",
        )}
      >
        {text || "(aucune sortie)"}
      </pre>
    </div>
  );
}
