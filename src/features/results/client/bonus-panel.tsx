"use client";

import { Gift } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { useActionRunner } from "@/lib/use-action-runner";
import { classBonusAction } from "../server/actions";

const fmt = (n: number) => String(n).replace(".", ",");

/** Points ajoutés à toute la classe (note plafonnée à 20), modifiables à tout moment. */
export function BonusPanel({ examId, bonusPoints }: { examId: string; bonusPoints: number }) {
  const [value, setValue] = useState(fmt(bonusPoints));
  const { state, pending, run } = useActionRunner();
  const parsed = Number(value.replace(",", "."));
  const valid = value.trim() !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 10;
  const dirty = valid && parsed !== bonusPoints;

  return (
    <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full bg-violet-bg text-violet"
          aria-hidden
        >
          <Gift className="size-5" />
        </span>
        <div className="flex flex-col">
          <h2 className="font-display text-lg font-bold">Bonus pour toute la classe</h2>
          <p className="text-sm text-muted">
            {bonusPoints > 0
              ? `+${fmt(bonusPoints)} point${bonusPoints > 1 ? "s" : ""} ajouté${bonusPoints > 1 ? "s" : ""} à chaque note sur 20 (plafonnée à 20).`
              : "Ajoute des points à la note sur 20 de chaque étudiant (plafonnée à 20)."}
          </p>
        </div>
      </div>
      <form
        className="flex flex-wrap items-end gap-3 border-t border-line-soft pt-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          const rounded = Math.round(parsed * 4) / 4;
          run(() => classBonusAction(examId, rounded));
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Points sur 20
          <span className="flex items-center gap-2">
            <span className="text-lg font-bold text-muted">+</span>
            <input
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={!valid}
              className="h-10 w-24 rounded-field border border-line bg-surface px-3 text-[15px] font-semibold tabular-nums outline-none focus:border-primary aria-invalid:border-danger-fill"
            />
          </span>
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[0.5, 1, 2].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setValue(fmt(n))}
              className="h-10 rounded-[10px] bg-canvas px-3 text-sm font-semibold text-ink-soft hover:bg-lilac"
            >
              +{fmt(n)}
            </button>
          ))}
        </div>
        <Button type="submit" variant="outline" size="sm" disabled={pending || !dirty}>
          {pending ? "Calcul…" : "Appliquer"}
        </Button>
        {bonusPoints > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => {
              setValue("0");
              run(() => classBonusAction(examId, 0));
            }}
          >
            Retirer le bonus
          </Button>
        ) : null}
      </form>
      {!valid ? <p className="text-xs text-danger">Entre 0 et 10 points.</p> : null}
      <FormMessage state={state} />
    </section>
  );
}
