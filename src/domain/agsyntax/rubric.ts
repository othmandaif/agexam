/**
 * Barème d'un algorithme, comme un professeur : chaque partie écrite rapporte
 * des points, même si le programme ne s'exécute pas. Sert de base quand la
 * relecture automatique n'est pas disponible, et au détail montré au formateur.
 */
export interface Criterion {
  key: "structure" | "declarations" | "entrees" | "traitement" | "sortie";
  label: string;
  /** Part de la note obtenue (0 à max). */
  score: number;
  max: number;
  note: string;
}

export const CRITERIA_MAX: Record<Criterion["key"], { label: string; max: number }> = {
  structure: { label: "Structure (ALGORITHME, VARIABLES, DEBUT, FIN)", max: 0.1 },
  declarations: { label: "Déclaration des variables", max: 0.15 },
  entrees: { label: "Lecture des données (LIRE)", max: 0.15 },
  traitement: { label: "Traitement (calculs, conditions, boucles)", max: 0.4 },
  sortie: { label: "Affichage du résultat (ECRIRE)", max: 0.2 },
};

/** Code sans commentaires ni chaînes, en majuscules sans accents. */
function clean(code: string): string {
  return code
    .replace(/\/\/.*$/gm, "")
    .replace(/"[^"\n]*"/g, '""')
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase();
}

const count = (re: RegExp, s: string) => (s.match(re) ?? []).length;
const ratio = (got: number, want: number) =>
  want <= 0 ? (got > 0 ? 1 : 0.5) : Math.min(1, got / want);
const r2 = (x: number) => Math.round(x * 100) / 100;

function features(code: string) {
  const c = clean(code);
  const varsBlock = /\bVARIABLES?\b([\s\S]*?)\bDEBUT\b/.exec(c)?.[1] ?? "";
  return {
    hasAlgo: /\bALGORITHME\b/.test(c),
    hasVars: /\bVARIABLES?\b/.test(c),
    hasDebut: /\bDEBUT\b/.test(c),
    hasFin: /\bFIN\s*$|\bFIN\b(?!\s*(SI|POUR|TANT))/m.test(c),
    declared: count(/[A-Z_][A-Z0-9_]*(?=\s*(,|:))/g, varsBlock),
    reads: count(/\bLIRE\s*\(/g, c),
    writes: count(/\b(ECRIRE|AFFICHER)\s*\(/g, c),
    assigns: count(/<-|←/g, c),
    si: count(/\bSI\b/g, c) - count(/\bFIN\s+SI\b/g, c),
    pour: count(/\bPOUR\b/g, c) - count(/\bFIN\s+POUR\b/g, c),
    tant: count(/\bTANT\s*QUE\b/g, c) - count(/\bFIN\s+TANT\s*QUE\b/g, c),
    repeter: count(/\bREPETER\b/g, c),
    ops: count(/[+\-*/^]|\bMOD\b|\bDIV\b/g, c.replace(/<-|←/g, "")),
  };
}

/** Barème « au mérite » du code de l'étudiant comparé au corrigé (structures attendues). */
export function heuristicRubric(code: string, solution: string): Criterion[] {
  const s = features(code);
  const ref = features(solution);
  const empty = !code.trim();
  const mk = (key: Criterion["key"], part: number, note: string): Criterion => ({
    key,
    label: CRITERIA_MAX[key].label,
    max: CRITERIA_MAX[key].max,
    score: empty ? 0 : r2(CRITERIA_MAX[key].max * Math.max(0, Math.min(1, part))),
    note: empty ? "Rien n'a été écrit." : note,
  });

  const structParts = [s.hasVars, s.hasDebut, s.hasFin].filter(Boolean).length;
  const ctrlWanted = [ref.si > 0, ref.pour > 0, ref.tant > 0, ref.repeter > 0];
  const ctrlHave = [
    s.si > 0,
    s.pour > 0 || s.tant > 0 || s.repeter > 0,
    s.tant > 0 || s.pour > 0,
    s.repeter > 0 || s.tant > 0,
  ];
  const wantedCount = ctrlWanted.filter(Boolean).length;
  const haveCount = ctrlWanted.filter((w, i) => w && ctrlHave[i]).length;
  const ctrlPart = wantedCount ? haveCount / wantedCount : 1;
  const calcPart = ratio(
    Math.min(s.assigns, ref.assigns || 1) + Math.min(s.ops, 1),
    (ref.assigns || 1) + (ref.ops ? 1 : 0),
  );
  const treatment = 0.55 * ctrlPart + 0.45 * calcPart;

  return [
    mk(
      "structure",
      structParts / 3,
      structParts === 3 ? "Structure complète." : "Structure incomplète.",
    ),
    mk(
      "declarations",
      ratio(s.declared, ref.declared),
      s.declared ? `${s.declared} variable(s) déclarée(s).` : "Aucune variable déclarée.",
    ),
    mk(
      "entrees",
      ratio(s.reads, ref.reads),
      s.reads ? `${s.reads} lecture(s).` : "Aucune lecture des données.",
    ),
    mk(
      "traitement",
      treatment,
      wantedCount && haveCount < wantedCount
        ? "Il manque une structure de contrôle attendue (condition ou boucle)."
        : "Démarche présente, à vérifier sur les résultats.",
    ),
    mk(
      "sortie",
      ratio(s.writes, ref.writes),
      s.writes ? "Résultat affiché." : "Aucun affichage du résultat.",
    ),
  ];
}

export const rubricTotal = (c: Criterion[]) => r2(c.reduce((a, x) => a + x.score, 0));
