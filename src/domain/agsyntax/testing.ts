/**
 * Jeux d'essai : exécution avec saisies fournies, sortie « utile » (sans les
 * messages de saisie ni l'écho des valeurs tapées) et comparaison tolérante
 * (majuscules, accents, espaces, ponctuation, lignes vides ignorés).
 */
import { runAlgorithm, type AlgoErrorInfo, type OutputSegment } from "./index";

/** Limites côté serveur : un jeu d'essai doit répondre vite. */
export const TEST_LIMITS = { maxSteps: 600_000, maxOutputChars: 50_000 } as const;
export const MAX_TESTS = 15;

export interface TestSpec {
  inputs: string[];
  expected: string;
  hidden: boolean;
}

export interface TestOutcome {
  passed: boolean;
  got: string;
  error: AlgoErrorInfo | null;
}

/**
 * Retire l'écho des saisies et la ligne de message qui précède chaque LIRE
 * (« Entrez un nombre : »), propre à chacun.
 */
export function usefulOutput(segments: OutputSegment[]): string {
  let acc = "";
  let mark = 0;
  for (const s of segments) {
    if (s.kind === "out") {
      acc += s.text;
      continue;
    }
    const region = acc.slice(mark).replace(/\n$/, "");
    const cut = region.lastIndexOf("\n");
    acc = acc.slice(0, mark) + (cut >= 0 ? region.slice(0, cut + 1) : "");
    mark = acc.length;
  }
  return acc
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/^\n+|\n+$/g, "");
}

/** Forme comparable d'une sortie : une entrée par ligne non vide. */
export function comparableLines(text: string): string[] {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/(\d),(\d)/g, "$1.$2")
    .split(/\r?\n/)
    .map((l) =>
      l
        .replace(/[:;,!?=«»"'()\-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

export function sameOutput(expected: string, got: string): boolean {
  const a = comparableLines(expected);
  const b = comparableLines(got);
  return a.length === b.length && a.every((l, i) => l === b[i]);
}

const NUMBER = /^-?\d+(?:\.\d+)?$/;
const normNumber = (t: string) => String(Number(t));
const words = (line: string) => line.split(" ").filter(Boolean);

/**
 * Vocabulaire des sorties attendues (mots non numériques).
 * - `all` : tous les mots, pour repérer une contradiction (« pair » au lieu de « impair ») ;
 * - `key` : les mots qui changent d'un jeu d'essai à l'autre (« pair » / « impair »,
 *   « admis » / « refusé ») : ce sont des résultats, ils doivent figurer dans la sortie.
 */
export interface OutputVocabulary {
  all: Set<string>;
  key: Set<string>;
}

export function outputVocabulary(expectedOutputs: string[]): OutputVocabulary {
  const perTest = expectedOutputs.map(
    (out) =>
      new Set(
        comparableLines(out)
          .flatMap(words)
          .filter((w) => !NUMBER.test(w)),
      ),
  );
  const all = new Set(perTest.flatMap((s) => [...s]));
  const key = new Set([...all].filter((w) => perTest.some((s) => !s.has(w))));
  return { all, key };
}

/**
 * Comparaison tolérante (examens, où l'étudiant ne voit pas la sortie attendue) :
 * mêmes lignes et mêmes nombres, libellés libres. Refusé si un mot-résultat
 * attendu manque (« 7 » au lieu de « 7 est impair »), si un mot contradictoire
 * apparaît (« pair » au lieu de « impair ») ou si la ligne n'a plus aucun mot.
 */
export function sameOutputLenient(expected: string, got: string, vocab: OutputVocabulary): boolean {
  if (sameOutput(expected, got)) return true;
  const a = comparableLines(expected);
  const b = comparableLines(got);
  if (a.length !== b.length) return false;
  let numbers = 0;
  for (let i = 0; i < a.length; i++) {
    const ea = words(a[i]!);
    const eb = words(b[i]!);
    const na = ea.filter((w) => NUMBER.test(w)).map(normNumber);
    const nb = eb.filter((w) => NUMBER.test(w)).map(normNumber);
    if (na.length !== nb.length || na.some((n, j) => n !== nb[j])) return false;
    numbers += na.length;
    // Sans nombre, la ligne doit être identique.
    if (na.length === 0 && a[i] !== b[i]) return false;
    const expectedWords = new Set(ea);
    const gotWords = new Set(eb);
    // Contradiction : un mot attendu ailleurs, absent de cette ligne.
    if (eb.some((w) => !NUMBER.test(w) && vocab.all.has(w) && !expectedWords.has(w))) return false;
    // Mot-résultat attendu absent.
    if (ea.some((w) => vocab.key.has(w) && !gotWords.has(w))) return false;
    // Texte attendu mais ligne réduite aux nombres.
    if (ea.length > na.length && eb.length === nb.length) return false;
  }
  return numbers > 0;
}

export function runTest(
  code: string,
  test: Pick<TestSpec, "inputs" | "expected">,
  options: { vocab?: OutputVocabulary } = {},
): TestOutcome {
  const r = runAlgorithm(code, { inputs: test.inputs, limits: TEST_LIMITS });
  const got = usefulOutput(r.segments);
  if (r.error) return { passed: false, got, error: r.error };
  const passed = options.vocab
    ? sameOutputLenient(test.expected, got, options.vocab)
    : sameOutput(test.expected, got);
  return { passed, got, error: null };
}

/**
 * Fige les sorties attendues en exécutant le corrigé. Le corrigé doit réussir
 * chaque jeu sans erreur, sinon le formateur est prévenu.
 */
export function freezeExpected(
  solution: string,
  cases: { inputs: string[]; hidden: boolean }[],
): { ok: true; tests: TestSpec[] } | { ok: false; index: number; error: AlgoErrorInfo } {
  const tests: TestSpec[] = [];
  for (const [index, c] of cases.entries()) {
    const r = runAlgorithm(solution, { inputs: c.inputs, limits: TEST_LIMITS });
    if (r.error) return { ok: false, index, error: r.error };
    tests.push({ inputs: c.inputs, hidden: c.hidden, expected: usefulOutput(r.segments) });
  }
  return { ok: true, tests };
}
