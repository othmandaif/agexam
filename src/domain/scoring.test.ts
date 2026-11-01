import { describe, expect, it } from "vitest";
import { isExactMatch, partialCredit, scoreAttempt, scoreQuestion } from "./scoring";

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

describe("note partielle des questions à plusieurs bonnes réponses", () => {
  // 3 choix, 2 bonnes (a, b), 1 fausse (c)
  const q = (selected: string[]) =>
    scoreQuestion({
      status: "REPONDUE",
      selectedOptionIds: selected,
      correctOptionIds: ["a", "b"],
      points: 2,
      optionCount: 3,
    });

  it("une bonne cochée sur deux : la moitié des points", () => {
    expect(q(["a"])).toMatchObject({ awarded: 1, isCorrect: false });
  });
  it("une bonne + une fausse : la fausse annule la bonne", () => {
    expect(q(["a", "c"]).awarded).toBe(0);
  });
  it("toutes les bonnes : tous les points", () => {
    expect(q(["a", "b"])).toMatchObject({ awarded: 2, isCorrect: true });
  });
  it("tout cocher ne rapporte rien", () => {
    expect(q(["a", "b", "c"]).awarded).toBe(0);
  });
  it("5 choix, 2 bonnes : 2 bonnes + 1 fausse = 1 − 1/3", () => {
    expect(partialCredit(["a", "b", "c"], ["a", "b"], 5)).toBeCloseTo(2 / 3);
  });
  it("une seule bonne réponse : toujours tout ou rien", () => {
    expect(
      scoreQuestion({
        status: "REPONDUE",
        selectedOptionIds: ["a"],
        correctOptionIds: ["b"],
        points: 2,
        optionCount: 4,
      }).awarded,
    ).toBe(0);
  });
  it("la note de l'examen additionne les parts", () => {
    const total = scoreAttempt([
      {
        status: "REPONDUE",
        selectedOptionIds: ["a"],
        correctOptionIds: ["a", "b"],
        points: 2,
        optionCount: 3,
      },
      {
        status: "REPONDUE",
        selectedOptionIds: ["x"],
        correctOptionIds: ["x"],
        points: 2,
        optionCount: 3,
      },
    ]);
    expect(total).toEqual({ awarded: 3, max: 4, outOf20: 15 });
  });
});

describe("question d'algorithme (ratio)", () => {
  const base = {
    status: "REPONDUE" as const,
    selectedOptionIds: [],
    correctOptionIds: [],
    points: 4,
  };
  it("accorde la part obtenue", () => {
    expect(scoreQuestion({ ...base, ratio: 0.65 })).toMatchObject({
      awarded: 2.6,
      max: 4,
      isCorrect: false,
    });
    expect(scoreQuestion({ ...base, ratio: 1 })).toMatchObject({ awarded: 4, isCorrect: true });
  });
  it("0 provisoire tant que la correction est en attente", () => {
    expect(scoreQuestion({ ...base, ratio: null })).toMatchObject({ awarded: 0, max: 4 });
  });
  it("neutralisée : hors barème", () => {
    expect(scoreQuestion({ ...base, status: "NEUTRALISEE", ratio: 1 }).counted).toBe(false);
  });
});

describe("note partielle (plusieurs bonnes réponses) : bonnes − fausses", () => {
  const base = { status: "REPONDUE" as const, points: 2, optionCount: 5 };
  const correct = ["a", "b"];
  const s = (sel: string[]) =>
    scoreQuestion({ ...base, selectedOptionIds: sel, correctOptionIds: correct }).awarded;
  it("toutes les bonnes, aucune fausse : note pleine", () => expect(s(["a", "b"])).toBe(2));
  it("une bonne sur deux : moitié", () => expect(s(["a"])).toBe(1));
  it("une bonne + une fausse : la fausse retire sa part (1/3 des fausses)", () =>
    expect(s(["a", "c"])).toBe(0.33));
  it("deux bonnes + une fausse", () => expect(s(["a", "b", "c"])).toBe(1.33));
  it("tout coché : 0", () => expect(s(["a", "b", "c", "d", "e"])).toBe(0));
  it("que des fausses : 0, jamais négatif", () => expect(s(["c", "d"])).toBe(0));
  it("rien coché : 0", () => expect(s([])).toBe(0));
  it("une seule bonne réponse : tout ou rien", () => {
    expect(
      scoreQuestion({ ...base, selectedOptionIds: ["a"], correctOptionIds: ["a"] }).awarded,
    ).toBe(2);
    expect(
      scoreQuestion({ ...base, selectedOptionIds: ["b"], correctOptionIds: ["a"] }).awarded,
    ).toBe(0);
  });
});
