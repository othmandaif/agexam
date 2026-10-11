"use client";

import { ArrowRight, Info } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { IDLE } from "@/lib/action-state";
import { cn } from "@/lib/utils";
import { joinByCodeAction } from "../server/actions";

const LENGTH = 6;

/** Saisie du code affiché en salle : 6 cases, collage accepté. */
export function JoinByCodeForm() {
  const [state, action] = useActionState(joinByCodeAction, IDLE);
  const [code, setCode] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  return (
    <form action={action} className="flex flex-col gap-4">
      <FormMessage state={state} />
      <label htmlFor="join-code" className="sr-only">
        Code d&apos;examen (6 caractères)
      </label>
      <div className="flex flex-wrap items-center gap-4">
        {/* Un seul vrai champ (accessible, collage) ; les cases sont un affichage. */}
        <div
          className="relative flex gap-2 rounded-[14px] border border-line bg-canvas p-2"
          onClick={() => inputRef.current?.focus()}
        >
          <input
            ref={inputRef}
            id="join-code"
            name="code"
            value={code}
            onChange={(e) =>
              setCode(
                e.target.value
                  .toUpperCase()
                  .replace(/[^A-Z0-9]/g, "")
                  .slice(0, LENGTH),
              )
            }
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            className="absolute inset-0 cursor-text opacity-0"
          />
          {Array.from({ length: LENGTH }, (_, i) => {
            const active =
              focused && (i === code.length || (i === LENGTH - 1 && code.length === LENGTH));
            return (
              <span
                key={i}
                aria-hidden
                className={cn(
                  "flex h-14 w-12 items-center justify-center rounded-[10px] border bg-surface font-mono text-[22px] font-bold text-ink transition-colors",
                  active ? "border-primary shadow-[0_0_0_3px_rgba(49,91,239,0.15)]" : "border-line",
                )}
              >
                {code[i] ?? (active ? <span className="h-6 w-0.5 animate-pulse bg-primary" /> : "")}
              </span>
            );
          })}
        </div>
        <SubmitButton
          size="lg"
          disabled={code.length !== LENGTH}
          pendingLabel="Recherche…"
          className="h-14 px-7"
        >
          Valider le code <ArrowRight aria-hidden />
        </SubmitButton>
      </div>
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <Info className="size-4 shrink-0 text-primary" aria-hidden />
        Le code seul ne suffit pas : vous devez faire partie d&apos;un groupe concerné.
      </p>
    </form>
  );
}
