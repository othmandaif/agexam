/**
 * Format texte des questions AGExam.
 *
 *   Q: Quelle structure répète un bloc tant qu'une condition est vraie ?
 *   A) Si … Alors
 *   B) TantQue … Faire *
 *   C) Pour
 *   DUREE: 30s
 *
 * - Une question commence par « Q: », « Question 3: », « 3. » ou, après une question
 *   terminée, par n'importe quelle ligne de texte (format Moodle Aiken).
 * - Bonne réponse : « * » en fin de ligne, ou ligne « REPONSE: B » / « ANSWER: A, C ».
 * - Plusieurs bonnes réponses : QCM à réponses multiples (détecté automatiquement).
 * - Code entre ``` (langage facultatif : pseudo, python, sql, js, c, java).
 * - Facultatif : DUREE, POINTS, EXPLICATION, TYPE.
 * - Question d'algorithme (TYPE: algo) : pas de réponses A), B)… ; corrigé entre
 *   ```solution et ``` ; une ligne « TEST: 5 ; 3 » par jeu d'essai (saisies
 *   séparées par « ; ») ; un bloc ``` simple = code de départ proposé.
 * - Question directe / rédaction (TYPE: texte) : réponse rédigée par l'étudiant,
 *   corrigée automatiquement ; réponse attendue (éléments clés) entre ```reponse et ```.
 *
 * Module pur : utilisé dans le navigateur (aperçu en direct) ET sur le serveur
 * (seule la version serveur fait foi à l'enregistrement).
 */
import type { CodeLanguage, QuestionType } from "./enums";
import { compile } from "./agsyntax";
import { formatDuration, isDurationInRange, parseDuration } from "./duration";

export const MAX_OPTIONS = 10;
export const MAX_QUESTIONS_PER_EXAM = 200;

export interface ParsedOption {
  letter: string;
  label: string;
  isCorrect: boolean;
  /** Non mélangée : « Aucune des réponses », « A et B »… */
  fixedPosition: boolean;
  line: number;
}

export type EditableField = "DUREE" | "POINTS";

export interface ParsedQuestion {
  /** Numéro affiché (1, 2, 3…). */
  number: number;
  /** Lignes du texte (commencent à 1). */
  startLine: number;
  lastContentLine: number;
  prompt: string;
  code: string | null;
  codeLanguage: CodeLanguage | null;
  options: ParsedOption[];
  type: QuestionType;
  /** Cases à cocher (plusieurs réponses possibles). */
  multipleAnswers: boolean;
  durationSec: number;
  /** false : durée suggérée automatiquement. */
  durationFromText: boolean;
  points: number;
  explanation: string | null;
  /** Question d'algorithme : corrigé + saisies des jeux d'essai (sorties figées à l'enregistrement).
   * kind « texte » : question directe / rédaction (réponse attendue dans `solution`). */
  algo: { solution: string; tests: { inputs: string[] }[]; kind?: "algo" | "texte" } | null;
  fieldLines: Partial<Record<EditableField, number>>;
  errors: string[];
  warnings: string[];
}

export const MAX_ALGO_TESTS = 15;

export interface ParseResult {
  questions: ParsedQuestion[];
  /** Erreurs hors question (mot-clé avant la première question…). */
  globalErrors: { line: number; message: string }[];
}

const RE_QUESTION = /^\s*(?:q(?:uestion)?\s*\d*\s*[:.)-]|\d{1,3}\s*[.)])\s*(.*)$/i;
const RE_OPTION = /^\s*(\*\s*)?([A-Ja-j])(?:\s*[).:]|\s+-)\s*(.+?)\s*$/;
const RE_KEYWORD =
  /^\s*(dur[ée]e|temps|time|duration|points?|pts|bar[èe]me|explication|explanation|feedback|answer|r[ée]ponses?|bonnes?\s+r[ée]ponses?|correct|type|tests?|essai)\s*[:=]\s*(.*?)\s*$/i;
const RE_FENCE_OPEN = /^\s*```\s*([\w+#\-\u00C0-\u017F]*)\s*$/;
const SOLUTION_TAGS = new Set([
  "solution",
  "corrige",
  "corrigé",
  "reference",
  "référence",
  "reponse",
  "réponse",
  "attendu",
  "attendue",
]);
const RE_FENCE_CLOSE = /^\s*```\s*$/;
const RE_CORRECT_MARK = /\s*(\*|✓|✔)\s*$/;
const RE_FIXED =
  /^(aucune|toutes|tous|aucun)\b.*\b(r[ée]ponses?|propositions?|ci-dessus|pr[ée]c[ée]dentes?)\b|^[a-j]\s+et\s+[a-j]\b/i;

const LANGUAGES: Record<string, CodeLanguage> = {
  "": "PSEUDO_CODE",
  pseudo: "PSEUDO_CODE",
  pseudocode: "PSEUDO_CODE",
  "pseudo-code": "PSEUDO_CODE",
  algo: "PSEUDO_CODE",
  algorithme: "PSEUDO_CODE",
  py: "PYTHON",
  python: "PYTHON",
  js: "JAVASCRIPT",
  javascript: "JAVASCRIPT",
  ts: "JAVASCRIPT",
  sql: "SQL",
  c: "C",
  java: "JAVA",
};

export function codeLanguageFromTag(tag: string): CodeLanguage {
  return LANGUAGES[tag.trim().toLowerCase()] ?? "AUTRE";
}

export function tagFromCodeLanguage(language: CodeLanguage | null): string {
  switch (language) {
    case "PYTHON":
      return "python";
    case "JAVASCRIPT":
      return "js";
    case "SQL":
      return "sql";
    case "C":
      return "c";
    case "JAVA":
      return "java";
    case "AUTRE":
      return "text";
    default:
      return "pseudo";
  }
}

const TYPES: Record<string, QuestionType> = {
  qcm: "QCM_SIMPLE",
  simple: "QCM_SIMPLE",
  qcm_simple: "QCM_SIMPLE",
  multiple: "QCM_MULTIPLE",
  qcm_multiple: "QCM_MULTIPLE",
  vf: "VRAI_FAUX",
  vrai_faux: "VRAI_FAUX",
  "vrai/faux": "VRAI_FAUX",
  "vrai-faux": "VRAI_FAUX",
  true_false: "VRAI_FAUX",
  trace: "TRACE_ALGORITHME",
  trace_algorithme: "TRACE_ALGORITHME",
  erreur: "RECHERCHE_ERREUR",
  recherche_erreur: "RECHERCHE_ERREUR",
  bug: "RECHERCHE_ERREUR",
  complexite: "COMPLEXITE",
  complexité: "COMPLEXITE",
  algo: "ALGORITHME",
  algorithme: "ALGORITHME",
  texte: "REDACTION",
  redaction: "REDACTION",
  rédaction: "REDACTION",
  directe: "REDACTION",
  question_directe: "REDACTION",
  ouverte: "REDACTION",
  libre: "REDACTION",
};

/** Durée proposée quand le formateur n'en indique pas. */
export function suggestDuration(q: {
  type: QuestionType;
  hasCode: boolean;
  multipleAnswers: boolean;
  promptLength: number;
}): number {
  let sec = 45;
  if (q.type === "VRAI_FAUX") sec = 30;
  else if (q.hasCode) sec = 90;
  else if (q.multipleAnswers) sec = 60;
  if (q.promptLength > 200) sec += 15;
  return sec;
}

interface Draft {
  startLine: number;
  lastContentLine: number;
  promptLines: string[];
  code: string | null;
  codeTag: string | null;
  codeAfterOptions: boolean;
  unclosedFence: boolean;
  options: ParsedOption[];
  /** Un mot-clé ou une ligne vide a suivi les réponses : la question est « fermée ». */
  closed: boolean;
  durationSec: number | null;
  points: number | null;
  explanation: string | null;
  explicitType: QuestionType | null;
  answerLetters: string[] | null;
  solution: string | null;
  tests: { inputs: string[] }[];
  fieldLines: Partial<Record<EditableField, number>>;
  errors: string[];
}

function newDraft(line: number, firstPromptLine: string): Draft {
  return {
    startLine: line,
    lastContentLine: line,
    promptLines: firstPromptLine.trim() ? [firstPromptLine.trim()] : [],
    code: null,
    codeTag: null,
    codeAfterOptions: false,
    unclosedFence: false,
    options: [],
    closed: false,
    durationSec: null,
    points: null,
    explanation: null,
    explicitType: null,
    answerLetters: null,
    solution: null,
    tests: [],
    fieldLines: {},
    errors: [],
  };
}

function applyKeyword(draft: Draft, rawKey: string, value: string, line: number) {
  const key = rawKey.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ");

  if (["duree", "temps", "time", "duration"].includes(key)) {
    const sec = parseDuration(value);
    draft.fieldLines.DUREE = line;
    if (sec === null) draft.errors.push(`Durée illisible « ${value} » (exemples : 30s, 1min30).`);
    else if (!isDurationInRange(sec)) draft.errors.push("Durée hors limites (5 s à 30 min).");
    else draft.durationSec = sec;
    return;
  }
  if (["points", "point", "pts", "bareme"].includes(key)) {
    const pts = Number(value.replace(",", "."));
    draft.fieldLines.POINTS = line;
    if (!Number.isFinite(pts) || pts <= 0 || pts > 100) {
      draft.errors.push(`Points invalides « ${value} » (nombre entre 0 et 100).`);
    } else draft.points = Math.round(pts * 100) / 100;
    return;
  }
  if (["explication", "explanation", "feedback"].includes(key)) {
    draft.explanation = value || null;
    return;
  }
  if (key === "type") {
    const t = TYPES[value.trim().toLowerCase().replace(/\s+/g, "_")];
    if (!t)
      draft.errors.push(
        `Type inconnu « ${value} » (qcm, multiple, vf, trace, erreur, complexite, algo, texte).`,
      );
    else draft.explicitType = t;
    return;
  }
  if (key === "test" || key === "tests" || key === "essai") {
    draft.tests.push({ inputs: value.trim() ? value.split(";").map((v) => v.trim()) : [] });
    return;
  }
  // answer / réponse(s) / bonne(s) réponse(s) / correct
  const tokens = value
    .toUpperCase()
    .split(/[\s,;/+]+|\bET\b/)
    .map((t) => t.replace(/[).:]$/, ""))
    .filter(Boolean);
  const invalid = tokens.filter((t) => !/^[A-J]$/.test(t));
  if (tokens.length === 0 || invalid.length > 0) {
    draft.errors.push(`Réponse attendue illisible « ${value} » (exemples : B ou A, C).`);
  } else {
    draft.answerLetters = [...new Set(tokens)];
  }
}

function finalize(draft: Draft, number: number): ParsedQuestion {
  const errors = [...draft.errors];
  const warnings: string[] = [];
  const prompt = draft.promptLines.join("\n").trim();
  const options = draft.options;

  if (draft.unclosedFence) errors.push("Bloc de code non fermé : ajoutez ``` à la fin du code.");
  if (draft.explicitType === "REDACTION") return finalizeText(draft, number, prompt, errors);
  if (draft.explicitType === "ALGORITHME" || draft.solution !== null || draft.tests.length > 0) {
    return finalizeAlgo(draft, number, prompt, errors);
  }
  if (draft.codeAfterOptions) errors.push("Le code doit être placé avant les réponses.");
  if (!prompt && !draft.code) errors.push("Énoncé manquant.");
  if (prompt.length > 4000) errors.push("Énoncé trop long (4000 caractères maximum).");

  const letters = new Set<string>();
  for (const o of options) {
    if (letters.has(o.letter)) errors.push(`Lettre ${o.letter} utilisée deux fois.`);
    letters.add(o.letter);
    if (o.label.length > 1000)
      errors.push(`Réponse ${o.letter} trop longue (1000 caractères max.).`);
  }

  if (draft.answerLetters) {
    const hadStars = options.some((o) => o.isCorrect);
    for (const l of draft.answerLetters) {
      if (!letters.has(l)) errors.push(`La réponse ${l} n'existe pas.`);
    }
    for (const o of options) o.isCorrect = draft.answerLetters.includes(o.letter);
    if (hadStars) warnings.push("La ligne RÉPONSE remplace les « * ».");
  }

  if (options.length < 2) errors.push("Au moins 2 réponses sont nécessaires.");
  if (options.length > MAX_OPTIONS) errors.push(`${MAX_OPTIONS} réponses maximum.`);

  const correctCount = options.filter((o) => o.isCorrect).length;
  if (options.length >= 2 && correctCount === 0) {
    errors.push("Aucune bonne réponse : ajoutez * à la fin de la bonne réponse.");
  }
  if (options.length >= 2 && correctCount === options.length) {
    warnings.push("Toutes les réponses sont marquées correctes.");
  }
  const labels = options.map((o) => o.label.toLowerCase());
  if (new Set(labels).size !== labels.length) warnings.push("Deux réponses ont le même texte.");

  const isTrueFalse =
    options.length === 2 &&
    labels.every((l) => ["vrai", "faux", "true", "false"].includes(l)) &&
    new Set(labels).size === 2;

  let type: QuestionType;
  if (draft.explicitType) {
    type = draft.explicitType;
    if (type === "QCM_SIMPLE" && correctCount > 1) {
      errors.push("Type « qcm » mais plusieurs bonnes réponses : utilisez « multiple ».");
    }
  } else if (isTrueFalse) type = "VRAI_FAUX";
  else if (correctCount > 1) type = "QCM_MULTIPLE";
  else if (draft.code) type = "TRACE_ALGORITHME";
  else type = "QCM_SIMPLE";

  const multipleAnswers = correctCount > 1 || type === "QCM_MULTIPLE";
  const durationSec =
    draft.durationSec ??
    suggestDuration({
      type,
      hasCode: !!draft.code,
      multipleAnswers,
      promptLength: prompt.length,
    });

  return {
    number,
    startLine: draft.startLine,
    lastContentLine: draft.lastContentLine,
    prompt,
    code: draft.code,
    codeLanguage: draft.code !== null ? codeLanguageFromTag(draft.codeTag ?? "") : null,
    options,
    type,
    multipleAnswers,
    durationSec,
    durationFromText: draft.durationSec !== null,
    points: draft.points ?? 1,
    explanation: draft.explanation,
    algo: null,
    fieldLines: draft.fieldLines,
    errors,
    warnings,
  };
}

function finalizeAlgo(
  draft: Draft,
  number: number,
  prompt: string,
  errors: string[],
): ParsedQuestion {
  const warnings: string[] = [];
  if (!prompt) errors.push("Énoncé manquant.");
  if (prompt.length > 4000) errors.push("Énoncé trop long (4000 caractères maximum).");
  if (draft.explicitType && draft.explicitType !== "ALGORITHME") {
    errors.push("Corrigé ou TEST réservés aux questions « TYPE: algo ».");
  }
  if (draft.options.length > 0) {
    errors.push("Une question d'algorithme n'a pas de réponses A), B)… : retirez-les.");
  }
  if (draft.solution === null || !draft.solution.trim()) {
    errors.push("Corrigé manquant : placez-le entre ```solution et ```.");
  } else {
    const c = compile(draft.solution);
    if (!c.ok) {
      errors.push(
        `Corrigé invalide${c.error.line ? ` (ligne ${c.error.line} du corrigé)` : ""} : ${c.error.message}`,
      );
    }
  }
  if (draft.tests.length === 0) {
    errors.push("Ajoutez au moins un jeu d'essai : « TEST: 5 ; 3 » (saisies séparées par ;).");
  }
  if (draft.tests.length > MAX_ALGO_TESTS) errors.push(`${MAX_ALGO_TESTS} jeux d'essai maximum.`);
  return {
    number,
    startLine: draft.startLine,
    lastContentLine: draft.lastContentLine,
    prompt,
    code: draft.code,
    codeLanguage: draft.code !== null ? "PSEUDO_CODE" : null,
    options: [],
    type: "ALGORITHME",
    multipleAnswers: false,
    durationSec: draft.durationSec ?? 600,
    durationFromText: draft.durationSec !== null,
    points: draft.points ?? 4,
    explanation: draft.explanation,
    algo: { solution: draft.solution ?? "", tests: draft.tests },
    fieldLines: draft.fieldLines,
    errors,
    warnings,
  };
}

function finalizeText(
  draft: Draft,
  number: number,
  prompt: string,
  errors: string[],
): ParsedQuestion {
  if (!prompt) errors.push("Énoncé manquant.");
  if (prompt.length > 4000) errors.push("Énoncé trop long (4000 caractères maximum).");
  if (draft.options.length > 0) {
    errors.push("Une question à réponse rédigée n'a pas de réponses A), B)… : retirez-les.");
  }
  if (draft.tests.length > 0)
    errors.push("Les lignes TEST sont réservées aux questions « TYPE: algo ».");
  if (draft.solution === null || !draft.solution.trim()) {
    errors.push("Réponse attendue manquante : placez-la entre ```reponse et ```.");
  } else if (draft.solution.length > 4000) {
    errors.push("Réponse attendue trop longue (4000 caractères maximum).");
  }
  return {
    number,
    startLine: draft.startLine,
    lastContentLine: draft.lastContentLine,
    prompt,
    code: draft.code,
    codeLanguage: draft.code !== null ? codeLanguageFromTag(draft.codeTag ?? "") : null,
    options: [],
    type: "REDACTION",
    multipleAnswers: false,
    durationSec: draft.durationSec ?? 300,
    durationFromText: draft.durationSec !== null,
    points: draft.points ?? 2,
    explanation: draft.explanation,
    algo: { kind: "texte", solution: draft.solution ?? "", tests: [] },
    fieldLines: draft.fieldLines,
    errors,
    warnings: [],
  };
}

/** Analyse le texte complet et renvoie les questions avec leurs erreurs. */
export function parseQuestionText(text: string): ParseResult {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const drafts: Draft[] = [];
  const globalErrors: ParseResult["globalErrors"] = [];
  let current: Draft | null = null;
  let fence: { lines: string[]; solution: boolean } | null = null;

  const start = (line: number, prompt: string) => {
    current = newDraft(line, prompt);
    drafts.push(current);
    return current;
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const line = i + 1;
    const draft = current as Draft | null;

    // Contenu d'un bloc de code : rien n'est interprété.
    if (fence) {
      if (RE_FENCE_CLOSE.test(raw)) {
        if (draft) {
          const body = fence.lines.join("\n").replace(/\s+$/, "");
          if (fence.solution) draft.solution = body;
          else draft.code = body;
          draft.unclosedFence = false;
          draft.lastContentLine = line;
        }
        fence = null;
      } else {
        fence.lines.push(raw);
      }
      continue;
    }

    if (raw.trim() === "") {
      if (draft && draft.options.length > 0) draft.closed = true;
      continue;
    }

    const q = RE_QUESTION.exec(raw);
    if (q) {
      start(line, q[1] ?? "");
      continue;
    }

    const fenceOpen = RE_FENCE_OPEN.exec(raw);
    if (fenceOpen) {
      const target = draft && !draft.closed ? draft : start(line, "");
      const tag = (fenceOpen[1] ?? "").toLowerCase();
      const solution = SOLUTION_TAGS.has(tag);
      if (target.options.length > 0 && !solution) target.codeAfterOptions = true;
      if (!solution) target.codeTag = fenceOpen[1] ?? "";
      target.unclosedFence = true;
      target.lastContentLine = line;
      fence = { lines: [], solution };
      continue;
    }

    const kw = RE_KEYWORD.exec(raw);
    if (kw) {
      if (!draft) {
        globalErrors.push({ line, message: `« ${kw[1]} » avant la première question.` });
        continue;
      }
      applyKeyword(draft, kw[1]!, kw[2] ?? "", line);
      draft.lastContentLine = line;
      if (draft.options.length > 0) draft.closed = true;
      continue;
    }

    const opt = RE_OPTION.exec(raw);
    if (opt && draft) {
      // Une réponse après une ligne vide reste rattachée à la même question.
      draft.closed = false;
      const leadingStar = !!opt[1];
      let label = opt[3] ?? "";
      const trailing = RE_CORRECT_MARK.test(label);
      if (trailing) label = label.replace(RE_CORRECT_MARK, "");
      draft.options.push({
        letter: opt[2]!.toUpperCase(),
        label: label.trim(),
        isCorrect: leadingStar || trailing,
        fixedPosition: RE_FIXED.test(label.trim()),
        line,
      });
      draft.lastContentLine = line;
      continue;
    }

    if (opt && !draft) {
      globalErrors.push({ line, message: "Réponse trouvée avant la première question." });
      continue;
    }

    // Ligne de texte libre.
    if (!draft || (draft.options.length > 0 && draft.closed) || draft.tests.length > 0) {
      start(line, raw);
    } else if (draft.options.length === 0) {
      draft.promptLines.push(raw.trim());
      draft.lastContentLine = line;
    } else {
      // Suite de la dernière réponse (réponse sur plusieurs lignes).
      const last = draft.options[draft.options.length - 1]!;
      let extra = raw.trim();
      if (RE_CORRECT_MARK.test(extra)) {
        extra = extra.replace(RE_CORRECT_MARK, "");
        last.isCorrect = true;
      }
      last.label = `${last.label} ${extra}`.trim();
      draft.lastContentLine = line;
    }
  }

  return { questions: drafts.map((d, i) => finalize(d, i + 1)), globalErrors };
}

export interface ParseSummary {
  questionCount: number;
  totalDurationSec: number;
  totalPoints: number;
  errorCount: number;
  warningCount: number;
}

export function summarize(result: ParseResult): ParseSummary {
  const qs = result.questions;
  return {
    questionCount: qs.length,
    totalDurationSec: qs.reduce((s, q) => s + q.durationSec, 0),
    totalPoints: Math.round(qs.reduce((s, q) => s + q.points, 0) * 100) / 100,
    errorCount: result.globalErrors.length + qs.reduce((s, q) => s + q.errors.length, 0),
    warningCount: qs.reduce((s, q) => s + q.warnings.length, 0),
  };
}

/**
 * Modifie (ou ajoute) la ligne « DUREE: … » ou « POINTS: … » d'une question
 * sans toucher au reste du texte.
 */
export function setQuestionField(
  text: string,
  question: Pick<ParsedQuestion, "fieldLines" | "lastContentLine">,
  field: EditableField,
  value: string,
): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const entry = `${field}: ${value}`;
  const existing = question.fieldLines[field];
  if (existing !== undefined) lines[existing - 1] = entry;
  else lines.splice(question.lastContentLine, 0, entry);
  return lines.join("\n");
}

/** Applique la même valeur à plusieurs questions (de la dernière à la première). */
export function setFieldForAll(
  text: string,
  questions: Pick<ParsedQuestion, "fieldLines" | "lastContentLine">[],
  field: EditableField,
  valueFor: (index: number) => string,
): string {
  const order = questions
    .map((q, index) => ({ q, index }))
    .sort((a, b) => b.q.lastContentLine - a.q.lastContentLine);
  let result = text;
  for (const { q, index } of order) result = setQuestionField(result, q, field, valueFor(index));
  return result;
}

const RE_ANSWER_LINE = /^\s*(answer|r[ée]ponses?|bonnes?\s+r[ée]ponses?|correct)\s*[:=]/i;

/**
 * Change les bonnes réponses d'une question dans le texte source (correction de la clé
 * après coup) : les « * » sont réécrits, une éventuelle ligne « RÉPONSE: » est retirée.
 * Le reste du texte (durée, points, explication, mise en forme) est conservé.
 */
export function setCorrectAnswers(
  text: string,
  question: Pick<ParsedQuestion, "options" | "startLine" | "lastContentLine">,
  correctLetters: readonly string[],
): string {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const correct = new Set(correctLetters.map((l) => l.toUpperCase()));
  const optionLines = new Set(question.options.map((o) => o.line));
  for (const o of question.options) {
    const raw = lines[o.line - 1] ?? "";
    const cleaned = raw.replace(/^(\s*)\*\s*/, "$1").replace(RE_CORRECT_MARK, "");
    lines[o.line - 1] = correct.has(o.letter.toUpperCase()) ? `${cleaned} *` : cleaned;
  }
  const drop = new Set<number>();
  let inFence = false;
  for (let n = question.startLine; n <= question.lastContentLine; n++) {
    const line = lines[n - 1] ?? "";
    if (RE_FENCE_OPEN.test(line) || (inFence && RE_FENCE_CLOSE.test(line))) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && !optionLines.has(n) && RE_ANSWER_LINE.test(line)) drop.add(n);
  }
  return lines.filter((_, i) => !drop.has(i + 1)).join("\n");
}

export interface QuestionTextInput {
  prompt: string;
  code?: string | null;
  codeLanguage?: CodeLanguage | null;
  options: { label: string; isCorrect: boolean }[];
  durationSec?: number | null;
  points?: number | null;
  explanation?: string | null;
  /** Type forcé (ligne « TYPE: ») : vf, trace, erreur, complexite… */
  type?: string;
  algo?: { solution: string; tests: { inputs: string[] }[]; kind?: "algo" | "texte" } | null;
}

/** Produit le texte au format AGExam (utilisé pour l'import Excel et l'exemple). */
export function buildQuestionText(items: QuestionTextInput[]): string {
  return items
    .map((item) => {
      const out: string[] = [];
      const [first = "", ...rest] = item.prompt.trim().split("\n");
      out.push(`Q: ${first}`, ...rest);
      const isText = item.algo?.kind === "texte";
      if (item.algo) out.push(isText ? "TYPE: texte" : "TYPE: algo");
      else if (item.type) out.push(`TYPE: ${item.type}`);
      if (item.code && item.code.trim()) {
        out.push(
          "```" + tagFromCodeLanguage(item.codeLanguage ?? "PSEUDO_CODE"),
          item.code.replace(/\s+$/, ""),
          "```",
        );
      }
      item.options.forEach((o, i) => {
        out.push(
          `${String.fromCharCode(65 + i)}) ${o.label.replace(/\s+/g, " ").trim()}${o.isCorrect ? " *" : ""}`,
        );
      });
      if (item.algo) {
        out.push(
          isText ? "```reponse" : "```solution",
          item.algo.solution.replace(/\s+$/, ""),
          "```",
        );
        for (const t of item.algo.tests) out.push(`TEST: ${t.inputs.join(" ; ")}`.trimEnd());
      }
      if (item.durationSec) out.push(`DUREE: ${formatDuration(item.durationSec)}`);
      if (item.points && (item.points !== 1 || item.algo)) out.push(`POINTS: ${item.points}`);
      if (item.explanation && item.explanation.trim()) {
        out.push(`EXPLICATION: ${item.explanation.replace(/\s+/g, " ").trim()}`);
      }
      return out.join("\n");
    })
    .join("\n\n");
}

/**
 * Exemple inséré par le bouton « Insérer un exemple » : un mini-examen qui montre
 * chaque type de question dans l'ordre conseillé. Le préfixe « [n/8 · type] » de
 * chaque énoncé sert de plan au formateur : à supprimer avant publication.
 */
export const EXAMPLE_QUESTION_TEXT = buildQuestionText([
  {
    prompt:
      "[1/8 · QCM une seule bonne réponse] Quelle structure répète un bloc tant qu'une condition est vraie ?",
    options: [
      { label: "Si … Alors", isCorrect: false },
      { label: "TantQue … Faire", isCorrect: true },
      { label: "Selon … Faire", isCorrect: false },
      { label: "Aucune des réponses", isCorrect: false },
    ],
    durationSec: 30,
    explanation: "Une seule réponse marquée d'une étoile * : QCM simple.",
  },
  {
    prompt:
      "[2/8 · QCM plusieurs bonnes réponses] Quelles instructions ajoutent un élément à la fin d'une liste Python ?",
    options: [
      { label: "liste.append(x)", isCorrect: true },
      { label: "liste.add(x)", isCorrect: false },
      { label: "liste.insert(len(liste), x)", isCorrect: true },
    ],
    durationSec: 60,
    points: 2,
    explanation: "Plusieurs étoiles * : note partielle (bonnes cochées − mauvaises cochées).",
  },
  {
    prompt: "[3/8 · Vrai / Faux] En pseudo-code, l'indice d'un tableau commence toujours à 1.",
    options: [
      { label: "Vrai", isCorrect: false },
      { label: "Faux", isCorrect: true },
    ],
    type: "vf",
    durationSec: 20,
  },
  {
    prompt: "[4/8 · Trace d'algorithme] Quelle valeur affiche l'algorithme suivant ?",
    code: "s ← 0\nPour i ← 1 à 5 Faire\n    Si i Mod 2 = 0 Alors\n        s ← s + i\n    FinSi\nFinPour\nÉcrire(s)",
    codeLanguage: "PSEUDO_CODE",
    options: [
      { label: "6", isCorrect: true },
      { label: "9", isCorrect: false },
      { label: "15", isCorrect: false },
    ],
    type: "trace",
    durationSec: 90,
    explanation: "Seuls 2 et 4 sont pairs : 2 + 4 = 6.",
  },
  {
    prompt: "[5/8 · Recherche d'erreur] Quelle ligne empêche la boucle de se terminer ?",
    code: "i ← 1\nTantQue i <= 5 Faire\n    Écrire(i)\nFinTantQue",
    codeLanguage: "PSEUDO_CODE",
    options: [
      { label: "i ← 1", isCorrect: false },
      { label: "TantQue i <= 5 Faire", isCorrect: false },
      { label: "Il manque i ← i + 1 dans la boucle", isCorrect: true },
    ],
    type: "erreur",
    durationSec: 60,
  },
  {
    prompt:
      "[6/8 · Complexité] Quelle est la complexité de la recherche séquentielle dans un tableau de n éléments ?",
    options: [
      { label: "O(1)", isCorrect: false },
      { label: "O(n)", isCorrect: true },
      { label: "O(n²)", isCorrect: false },
      { label: "O(log n)", isCorrect: false },
    ],
    type: "complexite",
    durationSec: 45,
  },
  {
    prompt:
      "[7/8 · Algorithme à écrire, exécuté et corrigé automatiquement] Lire n puis afficher la somme 1 + … + n.",
    options: [],
    algo: {
      solution:
        'VARIABLES\n  n, i, s : ENTIER\nDEBUT\n  LIRE(n)\n  s <- 0\n  POUR i DE 1 A n FAIRE\n    s <- s + i\n  FINPOUR\n  ECRIRE("Somme = ", s)\nFIN',
      tests: [{ inputs: ["5"] }, { inputs: ["0"] }],
    },
    durationSec: 600,
    points: 6,
    explanation: "Corrigé + jeux d'essai (TEST) : l'étudiant écrit et exécute son algorithme.",
  },
  {
    prompt:
      "[8/8 · Question directe / rédaction] Expliquez la différence entre une boucle POUR et une boucle TANT QUE.",
    options: [],
    algo: {
      kind: "texte",
      solution:
        "POUR : nombre d'itérations connu à l'avance (compteur).\nTANT QUE : répète tant qu'une condition est vraie, nombre d'itérations inconnu.",
      tests: [],
    },
    durationSec: 300,
    points: 2,
  },
]);
