import { AlgoError } from "./errors";

/**
 * Analyse lexicale du pseudo-code AGSyntax.
 * Mots-clés insensibles à la casse et aux accents (« Début », « FinSi »,
 * « Tant que », « Jusqu'à »…). Les identifiants aussi : `Total` et `total`
 * désignent la même variable.
 */
export type TokenType = "ident" | "kw" | "number" | "string" | "char" | "op" | "eof";

export interface Token {
  type: TokenType;
  /** Mot-clé normalisé (MAJUSCULES sans accents), opérateur, ou texte. */
  value: string;
  /** Texte d'origine (pour les messages). */
  raw: string;
  line: number;
  col: number;
  /** Un saut de ligne précède ce jeton. */
  nl: boolean;
  /** Valeur numérique (jetons number). */
  num?: number;
  /** Nombre écrit avec un point (réel). */
  isReal?: boolean;
}

/** Retire les accents et met en majuscules : « Début » → « DEBUT ». */
export function normalizeWord(word: string): string {
  return word.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/** Clé d'un identifiant : insensible à la casse et aux accents. */
export const identKey = (name: string) => normalizeWord(name).toLowerCase();

/** Mots réservés (ne peuvent pas servir de nom de variable). « A » reste libre. */
export const KEYWORDS = new Set([
  "ALGORITHME",
  "CONSTANTES",
  "CONSTANTE",
  "VARIABLES",
  "VARIABLE",
  "VAR",
  "DEBUT",
  "FIN",
  "ECRIRE",
  "AFFICHER",
  "SAUTLIGNE",
  "LIRE",
  "SI",
  "ALORS",
  "SINON",
  "SINONSI",
  "FINSI",
  "POUR",
  "DE",
  "PAS",
  "FAIRE",
  "FINPOUR",
  "TANT",
  "QUE",
  "TANTQUE",
  "FINTANTQUE",
  "REPETER",
  "JUSQUA",
  "PROCEDURE",
  "FONCTION",
  "FINPROCEDURE",
  "FINFONCTION",
  "RETOURNER",
  "RENVOYER",
  "ET",
  "OU",
  "NON",
  "DIV",
  "MOD",
  "VRAI",
  "FAUX",
  "TABLEAU",
]);

/** Noms de types : mots-clés en déclaration, fonctions de conversion en expression. */
export const TYPE_NAMES = new Set(["ENTIER", "REEL", "CHAINE", "CARACTERE", "BOOLEEN"]);

const isLetter = (c: string) => /[\p{L}_]/u.test(c);
const isIdentChar = (c: string) => /[\p{L}\p{N}_]/u.test(c);
const isDigit = (c: string) => c >= "0" && c <= "9";

export function tokenize(source: string): Token[] {
  const src = source.replace(/\r\n?/g, "\n");
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;
  let lineStart = 0;
  let nl = true;

  const push = (
    t: Omit<Token, "line" | "col" | "nl">,
    start: number,
    startLine: number,
    startCol: number,
  ) => {
    void start;
    tokens.push({ ...t, line: startLine, col: startCol, nl });
    nl = false;
  };

  while (i < src.length) {
    const c = src[i]!;
    if (c === "\n") {
      i++;
      line++;
      lineStart = i;
      nl = true;
      continue;
    }
    if (c === " " || c === "\t" || c === " ") {
      i++;
      continue;
    }
    // Commentaire « // … » jusqu'à la fin de la ligne
    if (c === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    const col = i - lineStart + 1;
    const startLine = line;

    if (isDigit(c)) {
      let j = i;
      while (j < src.length && isDigit(src[j]!)) j++;
      let isReal = false;
      // « 1..5 » : le point appartient à l'intervalle, pas au nombre.
      if (src[j] === "." && src[j + 1] !== "." && isDigit(src[j + 1] ?? "")) {
        isReal = true;
        j++;
        while (j < src.length && isDigit(src[j]!)) j++;
      }
      const raw = src.slice(i, j);
      push({ type: "number", value: raw, raw, num: Number(raw), isReal }, i, startLine, col);
      i = j;
      continue;
    }

    if (isLetter(c)) {
      let j = i;
      while (j < src.length && isIdentChar(src[j]!)) j++;
      let raw = src.slice(i, j);
      let word = normalizeWord(raw);
      // JUSQU'A / Jusqu'à
      if (word === "JUSQU" && (src[j] === "'" || src[j] === "’")) {
        let k = j + 1;
        while (k < src.length && isIdentChar(src[k]!)) k++;
        if (normalizeWord(src.slice(j + 1, k)) === "A") {
          raw = src.slice(i, k);
          word = "JUSQUA";
          j = k;
        }
      }
      if (KEYWORDS.has(word) || TYPE_NAMES.has(word)) {
        push({ type: "kw", value: word, raw }, i, startLine, col);
      } else {
        push({ type: "ident", value: raw, raw }, i, startLine, col);
      }
      i = j;
      continue;
    }

    if (c === '"' || c === "“" || c === "”") {
      let j = i + 1;
      let text = "";
      for (;;) {
        if (j >= src.length || src[j] === "\n") {
          throw new AlgoError(
            "syntax",
            startLine,
            'Texte non refermé : il manque le guillemet fermant ".',
          );
        }
        const d = src[j]!;
        if (d === '"' || d === "”" || d === "“") {
          if (src[j + 1] === '"') {
            text += '"';
            j += 2;
            continue;
          }
          j++;
          break;
        }
        text += d;
        j++;
      }
      push({ type: "string", value: text, raw: src.slice(i, j) }, i, startLine, col);
      i = j;
      continue;
    }

    if (c === "'" || c === "‘" || c === "’") {
      let j = i + 1;
      let text = "";
      while (j < src.length && src[j] !== "'" && src[j] !== "’" && src[j] !== "\n") {
        text += src[j];
        j++;
      }
      if (src[j] !== "'" && src[j] !== "’") {
        throw new AlgoError(
          "syntax",
          startLine,
          "Caractère non refermé : il manque l'apostrophe fermante '.",
        );
      }
      j++;
      push({ type: "char", value: text, raw: src.slice(i, j) }, i, startLine, col);
      i = j;
      continue;
    }

    const two = src.slice(i, i + 2);
    if (["<-", "<=", ">=", "<>", "..", "!="].includes(two)) {
      push({ type: "op", value: two === "!=" ? "<>" : two, raw: two }, i, startLine, col);
      i += 2;
      continue;
    }
    if (c === "←") {
      push({ type: "op", value: "<-", raw: c }, i, startLine, col);
      i++;
      continue;
    }
    if (c === "≤" || c === "≥" || c === "≠") {
      push(
        { type: "op", value: c === "≤" ? "<=" : c === "≥" ? ">=" : "<>", raw: c },
        i,
        startLine,
        col,
      );
      i++;
      continue;
    }
    if ("+-*/^()[],:=<>;".includes(c)) {
      push({ type: "op", value: c, raw: c }, i, startLine, col);
      i++;
      continue;
    }
    if (c === "×" || c === "÷") {
      push({ type: "op", value: c === "×" ? "*" : "/", raw: c }, i, startLine, col);
      i++;
      continue;
    }
    throw new AlgoError("syntax", startLine, `Caractère inattendu « ${c} ».`);
  }
  tokens.push({ type: "eof", value: "", raw: "fin du texte", line, col: 1, nl: true });
  return tokens;
}
