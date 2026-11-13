"use client";

import { Lightbulb, LoaderCircle, X } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { TraceResult } from "@/domain/agsyntax/trace";
import { homeworkHintAction } from "../server/actions";
import { TracePlayer } from "./trace-player";

type Hint = TraceResult & { code: string; inputs: string[] };

/** Indice animé : on regarde l'algorithme s'exécuter, puis on revient faire l'étape soi-même. */
export function StepHint({ stepId }: { stepId: string }) {
  const [hint, setHint] = useState<Hint | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const show = () => {
    setError(null);
    if (hint) return setOpen(true);
    start(async () => {
      const r = await homeworkHintAction(stepId);
      if (r.status === "success" && r.data) {
        setHint(r.data);
        setOpen(true);
      } else setError(r.status === "error" ? r.message : "Indice indisponible.");
    });
  };

  return (
    <section
      aria-label="Indice animé"
      className="flex flex-col gap-4 rounded-card border border-[#f5d27a] bg-[#fffdf6] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#fff1c2]">
            <Lightbulb className="size-5 text-[#d99a00]" aria-hidden />
          </span>
          <div className="flex flex-col">
            <p className="m-0 text-[15px] font-bold text-ink">Indice animé disponible</p>
            <p className="m-0 text-[13px] text-muted">
              Bloqué ? Regardez l&apos;algorithme s&apos;exécuter pas à pas, puis revenez écrire
              l&apos;étape.
            </p>
          </div>
        </div>
        {open ? (
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            <X aria-hidden /> Fermer l&apos;indice
          </Button>
        ) : (
          <Button size="sm" variant="soft" onClick={show} disabled={pending}>
            {pending ? (
              <>
                <LoaderCircle className="animate-spin" aria-hidden /> Préparation…
              </>
            ) : (
              "Ouvrir l'indice animé"
            )}
          </Button>
        )}
      </div>
      {error ? <p className="text-sm font-semibold text-danger">{error}</p> : null}
      {open && hint ? (
        <>
          <TracePlayer
            code={hint.code}
            frames={hint.frames}
            inputs={hint.inputs}
            truncated={hint.truncated}
          />
          <p className="text-[13px] text-muted">
            Une fois l&apos;idée comprise, fermez l&apos;indice et écrivez l&apos;étape avec vos
            propres mots : le copier-coller est désactivé.
          </p>
        </>
      ) : null}
    </section>
  );
}
