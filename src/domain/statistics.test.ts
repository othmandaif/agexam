import { describe, expect, it } from "vitest";
import {
  analyzeQuestion,
  histogram,
  observedDifficulty,
  summarizeScores,
  timeSpentSec,
  type QuestionResponse,
} from "./statistics";

describe("summarizeScores", () => {
  it("renvoie des valeurs nulles sans copie", () => {
    expect(summarizeScores([])).toMatchObject({
      count: 0,
      mean: null,
      median: null,
      passRate: null,
    });
  });

  it("calcule moyenne, médiane, écart-type, min, max, réussite", () => {
    const s = summarizeScores([8, 12, 10, 14, 6]);
    expect(s).toEqual({
      count: 5,
      mean: 10,
      median: 10,
      stdDev: 2.83,
      min: 6,
      max: 14,
      passRate: 0.6,
    });
  });

  it("médiane d'un nombre pair de notes", () => {
    expect(summarizeScores([4, 10, 12, 20]).median).toBe(11);
  });
});

describe("histogram", () => {
  it("10 tranches de 2 points, 20 dans la dernière", () => {
    const bins = histogram([0, 1.99, 2, 10, 19.5, 20]);
    expect(bins).toHaveLength(10);
    expect(bins[0]).toEqual({ from: 0, to: 2, count: 2 });
    expect(bins[1]!.count).toBe(1);
    expect(bins[5]!.count).toBe(1);
    expect(bins[9]).toEqual({ from: 18, to: 20, count: 2 });
  });
});

const r = (
  studentScore: number,
  selected: string[],
  isCorrect: boolean | null,
  extra: Partial<QuestionResponse> = {},
): QuestionResponse => ({
  studentScore,
  selectedOptionIds: selected,
  isCorrect,
  invalidated: false,
  timeSpentSec: 20,
  ...extra,
});

describe("analyzeQuestion", () => {
  const options = ["a", "b", "c"];

  it("compte les choix, la réussite et le temps moyen", () => {
    const a = analyzeQuestion(
      [
        r(15, ["a"], true, { timeSpentSec: 10 }),
        r(12, ["b"], false, { timeSpentSec: 30 }),
        r(9, [], false, { timeSpentSec: null }),
      ],
      ["a"],
      options,
    );
    expect(a).toMatchObject({
      responses: 3,
      answered: 2,
      correct: 1,
      choiceCounts: { a: 1, b: 1, c: 0 },
      avgTimeSec: 20,
      discrimination: null,
      signals: [],
    });
    expect(a.successRate).toBeCloseTo(1 / 3);
  });

  it("exclut les questions invalidées et neutralisées", () => {
    const a = analyzeQuestion(
      [r(10, ["a"], true), r(5, ["b"], false, { invalidated: true }), r(5, [], null)],
      ["a"],
      options,
    );
    expect(a.responses).toBe(1);
    expect(a.choiceCounts.b).toBe(0);
  });

  it("signale une clé suspecte : les meilleurs choisissent un distracteur", () => {
    const responses = [
      r(18, ["b"], false),
      r(17, ["b"], false),
      r(16, ["b"], false),
      r(9, ["b"], false),
      r(8, ["c"], false),
      r(6, ["a"], true),
      r(5, ["a"], true),
    ];
    const a = analyzeQuestion(responses, ["a"], options);
    expect(a.discrimination).toBeLessThan(0);
    expect(a.signals).toContain("SUSPECT_KEY");
  });

  it("signale une clé suspecte quand un distracteur écrase la bonne réponse", () => {
    const responses = [
      r(18, ["b"], false),
      r(16, ["a"], true),
      r(14, ["b"], false),
      r(12, ["b"], false),
      r(10, ["b"], false),
      r(8, ["b"], false),
      r(6, ["c"], false),
    ];
    expect(analyzeQuestion(responses, ["a"], options).signals).toContain("SUSPECT_KEY");
  });

  it("signale une question trop difficile ou trop facile", () => {
    const hard = analyzeQuestion(
      [r(18, ["a"], true), ...[10, 9, 8, 7, 6].map((s) => r(s, ["c"], false))],
      ["a"],
      options,
    );
    expect(hard.signals).toContain("TOO_HARD");
    const easy = analyzeQuestion(
      [20, 18, 15, 12, 10, 8].map((s) => r(s, ["a"], true)),
      ["a"],
      options,
    );
    expect(easy.signals).toEqual(["TOO_EASY"]);
  });

  it("question qui discrimine bien : aucun signal", () => {
    const a = analyzeQuestion(
      [
        r(18, ["a"], true),
        r(16, ["a"], true),
        r(14, ["a"], true),
        r(11, ["a"], true),
        r(8, ["b"], false),
        r(6, ["c"], false),
      ],
      ["a"],
      options,
    );
    expect(a.discrimination).toBe(1);
    expect(a.signals).toEqual([]);
  });
});

describe("timeSpentSec", () => {
  it("borne le temps à la durée de la question", () => {
    const t0 = new Date("2026-10-07T10:00:00Z");
    expect(timeSpentSec(t0, new Date("2026-10-07T10:00:12.4Z"), 30)).toBe(12);
    expect(timeSpentSec(t0, new Date("2026-10-07T10:01:00Z"), 30)).toBe(30);
    expect(timeSpentSec(null, t0, 30)).toBeNull();
  });
});

describe("observedDifficulty", () => {
  it("classe selon le taux de réussite, avec assez de réponses", () => {
    expect(observedDifficulty(0.8, 12)).toBe("FACILE");
    expect(observedDifficulty(0.75, 12)).toBe("FACILE");
    expect(observedDifficulty(0.5, 12)).toBe("MOYENNE");
    expect(observedDifficulty(0.39, 12)).toBe("DIFFICILE");
    expect(observedDifficulty(0.9, 9)).toBeNull();
    expect(observedDifficulty(null, 30)).toBeNull();
  });
});
