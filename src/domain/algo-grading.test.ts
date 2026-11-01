import { describe, expect, it } from "vitest";
import { combineAlgoRatio, finalAlgoRatio } from "./algo-grading";

describe("combineAlgoRatio", () => {
  it("jeux d'essai seuls sans relecture", () => {
    expect(combineAlgoRatio(0.5, null)).toBe(0.5);
  });
  it("les jeux réussis restent un plancher", () => {
    expect(combineAlgoRatio(1, 0)).toBe(1);
    expect(combineAlgoRatio(0.5, 0.1)).toBe(0.5);
  });
  it("la relecture accorde une note partielle même sans jeu réussi", () => {
    expect(combineAlgoRatio(0, 0.6)).toBe(0.6);
    expect(combineAlgoRatio(0.5, 0.8)).toBe(0.8);
  });
});

describe("finalAlgoRatio (professeur)", () => {
  it("note pleine : tous les jeux + verdict correct", () => {
    expect(finalAlgoRatio({ passed: 3, total: 3 }, { score: 0.9, verdict: "correct" })).toBe(1);
    expect(finalAlgoRatio({ passed: 3, total: 3 }, null)).toBe(1);
  });
  it("jeux réussis mais démarche fautive : la relecture tranche", () => {
    expect(finalAlgoRatio({ passed: 3, total: 3 }, { score: 0.3, verdict: "insuffisant" })).toBe(0.5);
    expect(finalAlgoRatio({ passed: 3, total: 3 }, { score: 0.9, verdict: "presque" })).toBe(1);
  });
  it("un jeu échoue : jamais la note pleine", () => {
    expect(finalAlgoRatio({ passed: 2, total: 3 }, { score: 1, verdict: "presque" })).toBe(0.95);
    expect(finalAlgoRatio({ passed: 0, total: 3 }, { score: 0.42, verdict: "partiel" })).toBe(0.42);
    expect(finalAlgoRatio({ passed: 2, total: 4 }, { score: 0.1, verdict: "insuffisant" })).toBe(0.5);
  });
  it("copie vide : 0", () => {
    expect(finalAlgoRatio({ passed: 0, total: 3 }, { score: 0, verdict: "vide" })).toBe(0);
  });
});
