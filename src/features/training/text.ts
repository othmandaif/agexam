/**
 * Import d'exercices d'entraînement en une fois (format texte) :
 *
 *   EXERCICE: Somme de deux nombres
 *   NIVEAU: 1
 *   Lire deux entiers a et b puis afficher « La somme est <a+b> ».
 *   ```depart
 *   …code proposé à l'étudiant (facultatif)…
 *   ```
 *   ```solution
 *   …corrigé…
 *   ```
 *   TEST: 2 ; 3
 *   TEST CACHE: 10 ; -4
 *
 * Module pur (aperçu dans le navigateur, validation sur le serveur).
 */
import { compile } from "@/domain/agsyntax";
import { MAX_TESTS } from "@/domain/agsyntax/testing";

export const MAX_IMPORT_EXERCISES = 60;

export interface ParsedExercise {
  number: number;
  line: number;
  title: string;
  level: number;
  statement: string;
  starterCode: string;
  solutionCode: string;
  tests: { inputs: string[]; hidden: boolean }[];
  /** Devoirs : code animé de l'indice (vide : le corrigé). */
  hintCode: string;
  /** Devoirs : saisies de l'animation (null : premier jeu visible). */
  hintInputs: string[] | null;
  errors: string[];
}

/** « EXERCICE: titre » (entraînement) ou « ETAPE: titre » (devoirs à distance). */
const RE_TITLE = /^\s*(?:exercice|[ée]tape)\s*\d*\s*[:.)-]\s*(.*)$/i;
const RE_LEVEL = /^\s*niveau\s*[:=]\s*(.*)$/i;
const RE_TEST = /^\s*(tests?|essai)(\s+cach[ée]s?)?\s*[:=]\s*(.*)$/i;
const RE_FENCE = /^\s*```\s*([\p{L}\w-]*)\s*$/u;

const SOLUTION_TAGS = new Set(["solution", "corrige", "corrigé"]);
const HINT_TAGS = new Set(["indice", "anime", "animé", "animation"]);
const RE_HINT_INPUTS = /^\s*indice\s+saisies?\s*[:=]\s*(.*)$/i;

interface Draft {
  line: number;
  title: string;
  level: number | null;
  statement: string[];
  starter: string | null;
  solution: string | null;
  hint: string | null;
  hintInputs: string[] | null;
  tests: { inputs: string[]; hidden: boolean }[];
  errors: string[];
}

export function parseExercisesText(text: string): {
  exercises: ParsedExercise[];
  globalErrors: string[];
} {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const drafts: Draft[] = [];
  const globalErrors: string[] = [];
  let cur: Draft | null = null;
  let fence: { kind: "starter" | "solution" | "hint"; body: string[]; line: number } | null = null;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!;
    const n = i + 1;
    if (fence) {
      if (/^\s*```\s*$/.test(raw)) {
        const body = fence.body.join("\n").replace(/\s+$/, "");
        if (cur) {
          if (fence.kind === "solution") cur.solution = body;
          else if (fence.kind === "hint") cur.hint = body;
          else cur.starter = body;
        }
        fence = null;
      } else fence.body.push(raw);
      continue;
    }
    const title = RE_TITLE.exec(raw);
    if (title) {
      cur = {
        line: n,
        title: (title[1] ?? "").trim(),
        level: null,
        statement: [],
        starter: null,
        solution: null,
        hint: null,
        hintInputs: null,
        tests: [],
        errors: [],
      };
      drafts.push(cur);
      continue;
    }
    if (!cur) {
      if (raw.trim())
        globalErrors.push(`Ligne ${n} : commencez par « EXERCICE: titre » (ou « ETAPE: titre »).`);
      continue;
    }
    const f = RE_FENCE.exec(raw);
    if (f) {
      const tag = (f[1] ?? "").toLowerCase();
      fence = {
        kind: SOLUTION_TAGS.has(tag) ? "solution" : HINT_TAGS.has(tag) ? "hint" : "starter",
        body: [],
        line: n,
      };
      continue;
    }
    const level = RE_LEVEL.exec(raw);
    if (level) {
      const v = Number(level[1]);
      if (!Number.isInteger(v) || v < 1 || v > 50)
        cur.errors.push(`Niveau invalide « ${level[1]} » (1 à 50).`);
      else cur.level = v;
      continue;
    }
    const hintInputs = RE_HINT_INPUTS.exec(raw);
    if (hintInputs) {
      const value = (hintInputs[1] ?? "").trim();
      cur.hintInputs = value ? value.split(";").map((v) => v.trim()) : [];
      continue;
    }
    const test = RE_TEST.exec(raw);
    if (test) {
      const value = (test[3] ?? "").trim();
      cur.tests.push({
        inputs: value ? value.split(";").map((v) => v.trim()) : [],
        hidden: !!test[2],
      });
      continue;
    }
    if (cur.tests.length === 0 && cur.solution === null) cur.statement.push(raw);
    else if (raw.trim())
      cur.errors.push(`Ligne ${n} ignorée : l'énoncé se place avant le code et les TEST.`);
  }
  if (fence) {
    const target = drafts.at(-1);
    target?.errors.push(`Bloc de code non fermé (ligne ${fence.line}) : ajoutez \`\`\`.`);
  }

  let lastLevel = 1;
  const exercises = drafts.map((d, i): ParsedExercise => {
    const errors = [...d.errors];
    const level = d.level ?? lastLevel;
    lastLevel = level;
    const statement = d.statement.join("\n").trim();
    if (!d.title) errors.push("Titre manquant après « EXERCICE: » / « ETAPE: ».");
    if (d.title.length > 120) errors.push("Titre trop long (120 caractères max.).");
    if (!statement) errors.push("Énoncé manquant (texte sous le titre).");
    if (!d.solution?.trim()) errors.push("Corrigé manquant : placez-le entre ```solution et ```.");
    else {
      const c = compile(d.solution);
      if (!c.ok)
        errors.push(
          `Corrigé invalide${c.error.line ? ` (ligne ${c.error.line} du corrigé)` : ""} : ${c.error.message}`,
        );
    }
    if (d.hint?.trim()) {
      const c = compile(d.hint);
      if (!c.ok)
        errors.push(
          `Code de l'indice invalide${c.error.line ? ` (ligne ${c.error.line} de l'indice)` : ""} : ${c.error.message}`,
        );
    }
    if (d.tests.length === 0) errors.push("Ajoutez au moins une ligne « TEST: … ».");
    if (d.tests.length > MAX_TESTS) errors.push(`${MAX_TESTS} jeux d'essai maximum.`);
    return {
      number: i + 1,
      line: d.line,
      title: d.title,
      level,
      statement,
      starterCode: d.starter ?? "",
      solutionCode: d.solution ?? "",
      tests: d.tests,
      hintCode: d.hint ?? "",
      hintInputs: d.hintInputs,
      errors,
    };
  });
  if (exercises.length > MAX_IMPORT_EXERCISES)
    globalErrors.push(`${MAX_IMPORT_EXERCISES} exercices maximum par import.`);
  return { exercises, globalErrors };
}

export const EXERCISES_TEMPLATE = `EXERCICE: Somme de deux nombres
NIVEAU: 1
Lire deux entiers a et b puis afficher :
La somme est <a + b>
\`\`\`solution
VARIABLES
  a, b : ENTIER
DEBUT
  ECRIRE("a ? ")
  LIRE(a)
  ECRIRE("b ? ")
  LIRE(b)
  ECRIRE("La somme est ", a + b)
FIN
\`\`\`
TEST: 2 ; 3
TEST CACHE: 10 ; -4

EXERCICE: Pair ou impair
NIVEAU: 1
Lire un entier n puis afficher « n est pair » ou « n est impair ».
\`\`\`depart
VARIABLES
  n : ENTIER
DEBUT

FIN
\`\`\`
\`\`\`solution
VARIABLES
  n : ENTIER
DEBUT
  LIRE(n)
  SI n MOD 2 = 0 ALORS
    ECRIRE(n, " est pair")
  SINON
    ECRIRE(n, " est impair")
  FINSI
FIN
\`\`\`
TEST: 7
TEST: 10
TEST CACHE: 0

EXERCICE: Somme de 1 à n
NIVEAU: 2
Lire n puis afficher la somme 1 + 2 + … + n :
Somme = <résultat>
\`\`\`solution
VARIABLES
  n, i, s : ENTIER
DEBUT
  LIRE(n)
  s <- 0
  POUR i DE 1 A n FAIRE
    s <- s + i
  FINPOUR
  ECRIRE("Somme = ", s)
FIN
\`\`\`
TEST: 5
TEST CACHE: 100
TEST CACHE: 0
`;

/**
 * Modèle d'un devoir à distance : un problème découpé en étapes, dans l'ordre.
 * Chaque étape a son énoncé, son corrigé (sert à l'indice animé) et ses tests.
 */
export const HOMEWORK_TEMPLATE = `ETAPE: Analyser les entrées et les sorties
Problème : calculer la moyenne de trois notes.
Déclarez les variables nécessaires (trois notes et la moyenne) puis affichez :
Entrées : 3 notes - Sortie : la moyenne
\`\`\`solution
VARIABLES
  n1, n2, n3, moy : REEL
DEBUT
  ECRIRE("Entrées : 3 notes - Sortie : la moyenne")
FIN
\`\`\`
TEST:

ETAPE: Lire les données
Lisez les trois notes puis affichez-les sur une ligne :
Notes : <n1> <n2> <n3>
\`\`\`solution
VARIABLES
  n1, n2, n3, moy : REEL
DEBUT
  LIRE(n1)
  LIRE(n2)
  LIRE(n3)
  ECRIRE("Notes : ", n1, " ", n2, " ", n3)
FIN
\`\`\`
TEST: 12 ; 15 ; 9
TEST CACHE: 0 ; 20 ; 10

ETAPE: Calculer
Calculez la somme des trois notes et affichez :
Somme = <somme>
\`\`\`solution
VARIABLES
  n1, n2, n3, s : REEL
DEBUT
  LIRE(n1)
  LIRE(n2)
  LIRE(n3)
  s <- n1 + n2 + n3
  ECRIRE("Somme = ", s)
FIN
\`\`\`
\`\`\`indice
VARIABLES
  a, b, s : REEL
DEBUT
  LIRE(a) // On lit la première valeur dans la case a
  LIRE(b) // Puis la deuxième dans la case b
  s <- a + b // On additionne et on range le total dans s
  ECRIRE("Somme = ", s) // On affiche le résultat
FIN
\`\`\`
INDICE SAISIES: 4 ; 6
TEST: 12 ; 15 ; 9
TEST CACHE: 10 ; 10 ; 10

ETAPE: Algorithme complet
Assemblez tout : lire les trois notes, calculer la moyenne et afficher :
Moyenne = <moyenne>
\`\`\`solution
VARIABLES
  n1, n2, n3, moy : REEL
DEBUT
  LIRE(n1)
  LIRE(n2)
  LIRE(n3)
  moy <- (n1 + n2 + n3) / 3
  ECRIRE("Moyenne = ", moy)
FIN
\`\`\`
TEST: 12 ; 15 ; 9
TEST CACHE: 10 ; 11 ; 12
TEST CACHE: 0 ; 0 ; 1
`;
