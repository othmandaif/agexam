import { describe, expect, it } from "vitest";
import { isExactMatch, scoreAttempt, scoreQuestion } from "./scoring";

describe("isExactMatch", () => {
  it("exige toutes les bonnes réponses et seulement elles", () => {
    expect(isExactMatch(["a", "c"], ["c", "a"])).toBe(true);
    expect(isExactMatch(["a"], ["a", "c"])).toBe(false);
    expect(isExactMatch(["a", "b", "c"], ["a", "c"])).toBe(false);
    expect(isExactMatch([], [])).toBe(false);
  });
});

describe("scoreQuestion", () => {
  const base = { selectedOptionIds: ["a"], correctOptionIds: ["a"], points: 2 };

  it("donne les points pour une bonne réponse", () => {
    expect(scoreQuestion({ ...base, status: "REPONDUE" })).toEqual({
      counted: true,
      awarded: 2,
      max: 2,
      isCorrect: true,
    });
  });

  it("compte 0 pour une question invalidée, même juste", () => {
    expect(scoreQuestion({ ...base, status: "INVALIDEE" }).awarded).toBe(0);
  });

  it("retire une question neutralisée du barème", () => {
    expect(scoreQuestion({ ...base, status: "NEUTRALISEE" })).toMatchObject({
      counted: false,
      max: 0,
    });
  });

  it("compte 0 pour une question expirée sans réponse", () => {
    expect(scoreQuestion({ ...base, selectedOptionIds: [], status: "EXPIREE" }).awarded).toBe(0);
  });
});

describe("scoreAttempt", () => {
  it("ramène la note sur 20 sans compter les neutralisées", () => {
    const score = scoreAttempt([
      { status: "REPONDUE", selectedOptionIds: ["a"], correctOptionIds: ["a"], points: 2 },
      { status: "REPONDUE", selectedOptionIds: ["b"], correctOptionIds: ["a"], points: 1 },
      { status: "NEUTRALISEE", selectedOptionIds: [], correctOptionIds: ["a"], points: 5 },
      {
        status: "REPONDUE",
        selectedOptionIds: ["x", "y"],
        correctOptionIds: ["y", "x"],
        points: 1,
      },
    ]);
    expect(score).toEqual({ awarded: 3, max: 4, outOf20: 15 });
  });

  it("renvoie 0 si aucune question ne compte", () => {
    expect(scoreAttempt([]).outOf20).toBe(0);
  });
});
