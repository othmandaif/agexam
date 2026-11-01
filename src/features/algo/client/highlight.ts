/**
 * Coloration du pseudo-code AGSyntax (affichage seulement : l'analyse réelle
 * est faite par l'interpréteur).
 */
const KEYWORDS =
  /^(ALGORITHME|CONSTANTES?|VARIABLES?|VAR|DEBUT|DÉBUT|FIN|SI|ALORS|SINON|FINSI|POUR|DE|A|À|PAS|FAIRE|FINPOUR|TANT|QUE|TANTQUE|FINTANTQUE|REPETER|RÉPÉTER|PROCEDURE|PROCÉDURE|FONCTION|RETOURNER|RENVOYER|TABLEAU|FINPROCEDURE|FINFONCTION)$/i;
const IO = /^(ECRIRE|ÉCRIRE|AFFICHER|LIRE|SAUTLIGNE)$/i;
const OPS_WORDS = /^(ET|OU|NON|DIV|MOD)$/i;
const LITERALS = /^(VRAI|FAUX)$/i;
const TYPES = /^(ENTIER|REEL|RÉEL|CHAINE|CHAÎNE|CARACTERE|CARACTÈRE|BOOLEEN|BOOLÉEN)$/i;
const BUILTINS =
  /^(RACINE|ABS|ENT|ARRONDI|ALEA|LONGUEUR|MAJUSCULE|MINUSCULE|SOUSCHAINE|CAR|ASCII)$/i;

export type TokenClass =
  "kw" | "io" | "op" | "lit" | "type" | "fn" | "str" | "num" | "comment" | "plain";

export interface Piece {
  text: string;
  cls: TokenClass;
}

export function highlightLine(line: string): Piece[] {
  const out: Piece[] = [];
  let i = 0;
  const push = (text: string, cls: TokenClass) => {
    if (!text) return;
    const last = out[out.length - 1];
    if (last && last.cls === cls) last.text += text;
    else out.push({ text, cls });
  };
  while (i < line.length) {
    const rest = line.slice(i);
    if (rest.startsWith("//")) {
      push(rest, "comment");
      break;
    }
    const c = line[i]!;
    if (c === '"') {
      const end = line.indexOf('"', i + 1);
      const j = end < 0 ? line.length : end + 1;
      push(line.slice(i, j), "str");
      i = j;
      continue;
    }
    if (c === "'" && /^'[^']'/.test(rest)) {
      push(rest.slice(0, 3), "str");
      i += 3;
      continue;
    }
    const num = /^\d+(\.\d+)?/.exec(rest);
    if (num) {
      push(num[0], "num");
      i += num[0].length;
      continue;
    }
    const word = /^[\p{L}_][\p{L}\p{N}_]*('[AÀaà])?/u.exec(rest);
    if (word) {
      const w = word[0];
      const bare = w.replace(/'.*/, "");
      let cls: TokenClass = "plain";
      if (/^JUSQU'/i.test(w) || KEYWORDS.test(bare)) cls = "kw";
      else if (IO.test(bare)) cls = "io";
      else if (OPS_WORDS.test(bare)) cls = "op";
      else if (LITERALS.test(bare)) cls = "lit";
      else if (TYPES.test(bare)) cls = "type";
      else if (BUILTINS.test(bare)) cls = "fn";
      // « A » n'est un mot-clé que dans un POUR : en dehors, c'est une variable.
      if (cls === "kw" && /^(a|à)$/i.test(bare) && !/\bPOUR\b/i.test(line)) cls = "plain";
      push(w, cls);
      i += w.length;
      continue;
    }
    if (rest.startsWith("<-") || c === "←") {
      push(rest.startsWith("<-") ? "<-" : c, "op");
      i += rest.startsWith("<-") ? 2 : 1;
      continue;
    }
    push(c, /[+\-*/^=<>]/.test(c) ? "op" : "plain");
    i++;
  }
  return out;
}

export const TOKEN_STYLE: Record<TokenClass, string> = {
  kw: "text-[#315bef] font-semibold",
  io: "text-[#0e7490] font-semibold",
  op: "text-[#9333ea]",
  lit: "text-[#c2410c] font-semibold",
  type: "text-[#7c3aed] font-semibold",
  fn: "text-[#0f766e]",
  str: "text-[#15803d]",
  num: "text-[#c2410c]",
  comment: "text-[#94a3b8] italic",
  plain: "text-ink",
};

/** Indentation à ajouter après une ligne qui ouvre un bloc. */
export function opensBlock(line: string): boolean {
  const t = line
    .replace(/\/\/.*$/, "")
    .trim()
    .toUpperCase();
  return (
    /\b(ALORS|FAIRE|SINON)$/.test(t) ||
    /^(DEBUT|DÉBUT|REPETER|RÉPÉTER|VARIABLES?|CONSTANTES?)$/.test(t)
  );
}

/** Ligne qui ferme un bloc : on la désindente en la tapant. */
export function closesBlock(line: string): boolean {
  return /^\s*(FINSI|FIN\s*SI|FINPOUR|FIN\s*POUR|FINTANTQUE|FIN\s*TANT\s*QUE|SINON|JUSQU'?A|FIN)\b/i.test(
    line,
  );
}
