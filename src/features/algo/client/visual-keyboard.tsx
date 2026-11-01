"use client";

import { Delete, Space } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const TABS = {
  Symboles: [
    "<-",
    "(",
    ")",
    '"',
    "'",
    ",",
    ":",
    ";",
    "+",
    "-",
    "*",
    "/",
    "^",
    "=",
    "<>",
    "<",
    ">",
    "<=",
    ">=",
    "[",
    "]",
    "..",
  ],
  Chiffres: ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "."],
  Lettres: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  "Mots-clés": [
    "ALGORITHME",
    "VARIABLES",
    "DEBUT",
    "FIN",
    "ENTIER",
    "REEL",
    "CHAINE",
    "BOOLEEN",
    "LIRE()",
    "ECRIRE()",
    "SI",
    "ALORS",
    "SINON",
    "FINSI",
    "POUR",
    "DE",
    "A",
    "FAIRE",
    "FINPOUR",
    "TANT QUE",
    "FINTANTQUE",
    "REPETER",
    "JUSQU'A",
    "ET",
    "OU",
    "NON",
    "MOD",
    "DIV",
  ],
} as const;
type Tab = keyof typeof TABS;

/** Clavier visuel : symboles, chiffres, lettres et mots-clés insérés au curseur. */
export function VisualKeyboard({
  onInsert,
  onBackspace,
  disabled,
}: {
  onInsert: (text: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Symboles");
  const [lower, setLower] = useState(false);
  const insertKey = (k: string) => {
    if (k === "LIRE()" || k === "ECRIRE()") return onInsert(k.slice(0, -1) + "(");
    if (tab === "Mots-clés") return onInsert(k + " ");
    onInsert(tab === "Lettres" && lower ? k.toLowerCase() : k);
  };
  return (
    <div className="flex flex-col gap-2 rounded-[12px] border border-line bg-canvas p-3 select-none">
      <div className="flex flex-wrap items-center gap-1.5" role="tablist">
        {(Object.keys(TABS) as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full px-3 py-1 text-[12.5px] font-bold",
              tab === t ? "bg-primary text-white" : "bg-surface text-muted hover:text-ink",
            )}
          >
            {t}
          </button>
        ))}
        {tab === "Lettres" ? (
          <button
            type="button"
            onClick={() => setLower((v) => !v)}
            className="ml-auto rounded-full bg-surface px-3 py-1 text-[12.5px] font-bold text-muted"
          >
            {lower ? "ABC" : "abc"}
          </button>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {TABS[tab].map((k) => (
          <button
            key={k}
            type="button"
            disabled={disabled}
            // Garde le focus (et le curseur) dans l'éditeur.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => insertKey(k)}
            className="min-w-9 rounded-[8px] border border-line bg-surface px-2.5 py-1.5 font-mono text-[13.5px] font-semibold text-ink shadow-[0_1px_0_rgba(0,0,0,0.06)] hover:border-primary/50 hover:bg-primary-wash active:translate-y-px disabled:opacity-50"
          >
            {tab === "Lettres" && lower ? k.toLowerCase() : k}
          </button>
        ))}
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert(" ")}
          aria-label="Espace"
          className="flex min-w-20 items-center justify-center rounded-[8px] border border-line bg-surface px-3 py-1.5 hover:bg-primary-wash disabled:opacity-50"
        >
          <Space className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onInsert("\n")}
          className="rounded-[8px] border border-line bg-surface px-3 py-1.5 text-[12.5px] font-bold hover:bg-primary-wash disabled:opacity-50"
        >
          Entrée ↵
        </button>
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={onBackspace}
          aria-label="Effacer"
          className="flex items-center justify-center rounded-[8px] border border-line bg-surface px-3 py-1.5 hover:bg-danger-bg disabled:opacity-50"
        >
          <Delete className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
