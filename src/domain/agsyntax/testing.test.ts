import { describe, expect, it } from "vitest";
import {
  freezeExpected,
  outputVocabulary,
  runTest,
  sameOutput,
  sameOutputLenient,
  usefulOutput,
} from "./testing";
import { runAlgorithm } from "./index";

const SOMME = `ALGORITHME Somme
VARIABLES
  a, b : ENTIER
DEBUT
  ECRIRE("Entrez a : ")
  LIRE(a)
  ECRIRE("Entrez b : ")
  LIRE(b)
  ECRIRE("La somme est ", a + b)
FIN`;

describe("jeux d'essai", () => {
  it("retire messages de saisie et échos", () => {
    const r = runAlgorithm(SOMME, { inputs: ["2", "3"] });
    expect(usefulOutput(r.segments)).toBe("La somme est 5");
  });

  it("compare sans tenir compte de la casse, des accents ni de la ponctuation", () => {
    expect(sameOutput("La somme est : 5", "la   SOMME est 5\n\n")).toBe(true);
    expect(sameOutput("Élève admis", "eleve admis")).toBe(true);
    expect(sameOutput("La somme est 5", "La somme est 6")).toBe(false);
    expect(sameOutput("a\nb", "a")).toBe(false);
  });

  it("fige depuis le corrigé et teste une autre formulation des messages", () => {
    const frozen = freezeExpected(SOMME, [{ inputs: ["4", "6"], hidden: false }]);
    expect(frozen.ok).toBe(true);
    if (!frozen.ok) return;
    expect(frozen.tests[0]!.expected).toBe("La somme est 10");
    const student = SOMME.replace(/Entrez a : /, "Donner le premier").replace(
      /Entrez b : /,
      "Donner le second",
    );
    expect(runTest(student, frozen.tests[0]!).passed).toBe(true);
    expect(runTest(SOMME.replace("a + b", "a * b"), frozen.tests[0]!).passed).toBe(false);
  });

  it("signale un corrigé qui échoue (saisies manquantes)", () => {
    const frozen = freezeExpected(SOMME, [{ inputs: ["1"], hidden: false }]);
    expect(frozen.ok).toBe(false);
  });

  it("arrête une boucle infinie", () => {
    const loop = `VARIABLES\n i : ENTIER\nDEBUT\n i <- 0\n TANT QUE i >= 0 FAIRE\n  i <- i + 1\n FINTANTQUE\nFIN`;
    const r = runTest(loop, { inputs: [], expected: "" });
    expect(r.passed).toBe(false);
    expect(r.error).not.toBeNull();
  });
});

describe("comparaison tolérante (examen)", () => {
  const vocab = outputVocabulary(["15 est impair", "4 est pair"]);
  it("libellé différent, mêmes nombres", () => {
    const v = outputVocabulary(["Somme = 15"]);
    expect(sameOutputLenient("Somme = 15", "La somme est 15", v)).toBe(true);
    expect(sameOutputLenient("Somme = 15", "Total : 15", v)).toBe(true);
    expect(sameOutputLenient("Somme = 15", "Somme = 14", v)).toBe(false);
    expect(
      sameOutputLenient("Moyenne 12.5", "moyenne : 12,5", outputVocabulary(["Moyenne 12.5"])),
    ).toBe(true);
  });
  it("refuse un mot contradictoire du vocabulaire attendu", () => {
    expect(sameOutputLenient("15 est impair", "15 est pair", vocab)).toBe(false);
    expect(sameOutputLenient("15 est impair", "Le nombre 15 est impair", vocab)).toBe(true);
  });
  it("refuse un mot-résultat absent ou une ligne réduite au nombre", () => {
    const v = outputVocabulary(["7 est impair", "4 est pair", "0 est pair"]);
    expect(sameOutputLenient("7 est impair", "7", v)).toBe(false);
    expect(sameOutputLenient("7 est impair", "Le nombre 7", v)).toBe(false);
    expect(sameOutputLenient("7 est impair", "Résultat : 7 impair", v)).toBe(true);
    expect(sameOutputLenient("Somme = 15", "15", outputVocabulary(["Somme = 15"]))).toBe(false);
  });
  it("sans nombre : texte identique exigé", () => {
    expect(sameOutputLenient("Admis", "Refusé", outputVocabulary(["Admis", "Refusé"]))).toBe(false);
  });
});
