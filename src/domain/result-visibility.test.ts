import { describe, expect, it } from "vitest";
import { areResultsReleased, revealLevel, type ResultReleaseInput } from "./result-visibility";

const closesAt = new Date("2026-10-07T12:00:00.000Z");
const before = new Date("2026-10-07T11:00:00.000Z");
const after = new Date("2026-10-07T12:30:00.000Z");

const input = (over: Partial<ResultReleaseInput> = {}): ResultReleaseInput => ({
  visibility: "NOTE",
  releaseMode: "IMMEDIAT",
  examStatus: "OUVERT",
  examClosesAt: closesAt,
  resultsPublishedAt: null,
  attemptSubmitted: true,
  ...over,
});

describe("areResultsReleased", () => {
  it("ne publie rien tant que la tentative n'est pas soumise", () => {
    expect(areResultsReleased(input({ attemptSubmitted: false }), after)).toBe(false);
  });

  it("publie immédiatement en mode IMMEDIAT", () => {
    expect(areResultsReleased(input(), before)).toBe(true);
  });

  it("attend la fermeture en mode APRES_FERMETURE", () => {
    const i = input({ releaseMode: "APRES_FERMETURE" });
    expect(areResultsReleased(i, before)).toBe(false);
    expect(areResultsReleased(i, after)).toBe(true);
    expect(areResultsReleased({ ...i, examStatus: "FERME" }, before)).toBe(true);
  });

  it("attend l'action du formateur en mode MANUEL", () => {
    const i = input({ releaseMode: "MANUEL" });
    expect(areResultsReleased(i, after)).toBe(false);
    expect(areResultsReleased({ ...i, resultsPublishedAt: before }, after)).toBe(true);
  });
});

describe("revealLevel", () => {
  it("renvoie AUCUNE si non publié", () => {
    expect(revealLevel(input({ releaseMode: "MANUEL" }), after)).toBe("AUCUNE");
  });

  it("ne donne jamais la correction avant la fermeture", () => {
    const i = input({ visibility: "CORRECTION" });
    expect(revealLevel(i, before)).toBe("NOTE_DETAIL");
    expect(revealLevel(i, after)).toBe("CORRECTION");
  });
});
