import type { CodeLanguage } from "./enums";

export interface FingerprintInput {
  prompt: string;
  code: string | null;
  codeLanguage: CodeLanguage | null;
  explanation: string | null;
  options: readonly { label: string; isCorrect: boolean; fixedPosition?: boolean }[];
}

/** Séparateur ASCII « unit separator » : n'apparaît jamais dans un texte saisi. */
const SEP = "\u001f";

/**
 * Texte canonique d'une question : deux questions au contenu identique (énoncé, code,
 * réponses, bonnes réponses, explication) ont le même texte, donc la même empreinte.
 * La durée et les points n'en font pas partie : ils sont propres à chaque examen.
 *
 * ⚠ Reproduit en SQL dans la migration 0005 (calcul des empreintes existantes) :
 * toute modification ici impose une nouvelle migration de recalcul.
 */
export function canonicalQuestion(q: FingerprintInput): string {
  return [
    q.prompt,
    q.code ?? "",
    q.codeLanguage ?? "",
    q.explanation ?? "",
    ...q.options.map((o) => `${o.isCorrect ? "1" : "0"}${o.fixedPosition ? "1" : "0"}${o.label}`),
  ].join(SEP);
}
