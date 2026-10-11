"use client";

import { BookOpenText } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Aide-mémoire du format texte, repliable. */
export function FormatGuide({ onInsertExample }: { onInsertExample: () => void }) {
  return (
    <details className="group rounded-xl border border-line bg-canvas">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-bold text-ink-soft">
        <BookOpenText className="size-4 text-primary" aria-hidden />
        Comment écrire les questions ?
        <span className="ml-auto text-xs font-semibold text-primary group-open:hidden">
          Afficher
        </span>
        <span className="ml-auto hidden text-xs font-semibold text-primary group-open:inline">
          Masquer
        </span>
      </summary>
      <div className="grid gap-4 border-t border-line px-4 py-4 text-sm text-ink-soft md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <pre className="min-w-0 overflow-x-auto rounded-lg bg-surface p-3 font-mono text-[13px] leading-relaxed text-ink">{`Q: Quelle structure répète un bloc ?
A) Si … Alors
B) TantQue … Faire *
C) Pour
DUREE: 30s

Q: Que vaut s ?
\`\`\`pseudo
s ← 0
Pour i ← 1 à 3 Faire
    s ← s + i
FinPour
\`\`\`
A) 3
B) 6 *
DUREE: 1min30
POINTS: 2`}</pre>
        <ul className="flex flex-col gap-2">
          <li>
            <strong>Q:</strong> commence une question (ou « 1. », « Question 2: »). Une ligne vide
            sépare les questions.
          </li>
          <li>
            <strong>A) B) C)</strong> : les réponses, de 2 à 10.
          </li>
          <li>
            <strong>*</strong> en fin de ligne = bonne réponse. Plusieurs <strong>*</strong> = QCM à
            plusieurs réponses. Ou bien une ligne <code>REPONSE: B</code> (format Moodle).
          </li>
          <li>
            Code entre <code>```</code> avant les réponses. Langage facultatif : <code>pseudo</code>
            , <code>python</code>, <code>sql</code>, <code>js</code>…
          </li>
          <li>
            Facultatif : <code>DUREE: 45s</code>, <code>POINTS: 2</code>,{" "}
            <code>EXPLICATION: …</code>. Sans durée, une durée est proposée automatiquement.
          </li>
          <li>« Aucune des réponses » reste toujours à sa place lors du mélange.</li>
          <li>
            <Button size="sm" variant="outline" onClick={onInsertExample}>
              Insérer un exemple
            </Button>
          </li>
        </ul>
      </div>
    </details>
  );
}
