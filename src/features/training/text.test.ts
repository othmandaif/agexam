import { describe, expect, it } from "vitest";
import { freezeExpected } from "@/domain/agsyntax/testing";
import { EXERCISES_TEMPLATE, parseExercisesText } from "./text";

describe("import d'exercices", () => {
  it("le modèle est valide et ses corrigés passent leurs jeux", () => {
    const r = parseExercisesText(EXERCISES_TEMPLATE);
    expect(r.globalErrors).toEqual([]);
    expect(r.exercises).toHaveLength(3);
    expect(r.exercises.map((e) => e.errors)).toEqual([[], [], []]);
    expect(r.exercises.map((e) => e.level)).toEqual([1, 1, 2]);
    expect(r.exercises[0]!.tests).toEqual([
      { inputs: ["2", "3"], hidden: false },
      { inputs: ["10", "-4"], hidden: true },
    ]);
    expect(r.exercises[1]!.starterCode).toContain("n : ENTIER");
    for (const e of r.exercises) expect(freezeExpected(e.solutionCode, e.tests).ok).toBe(true);
  });
  it("signale les manques", () => {
    const r = parseExercisesText("bla\nEXERCICE: X\nTEST: 1");
    expect(r.globalErrors[0]).toMatch(/EXERCICE/);
    expect(r.exercises[0]!.errors.join(" ")).toMatch(/Énoncé manquant/);
    expect(r.exercises[0]!.errors.join(" ")).toMatch(/Corrigé manquant/);
  });
});

describe("modèle des devoirs à distance", () => {
  it("accepte « ETAPE: » et donne 4 étapes valides", async () => {
    const { HOMEWORK_TEMPLATE } = await import("./text");
    const p = parseExercisesText(HOMEWORK_TEMPLATE);
    expect(p.globalErrors).toEqual([]);
    expect(p.exercises).toHaveLength(4);
    expect(p.exercises.every((e) => e.errors.length === 0)).toBe(true);
  });
});
