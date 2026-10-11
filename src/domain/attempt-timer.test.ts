import { describe, expect, it } from "vitest";
import {
  clockOffsetMs,
  isAnswerAccepted,
  isExpired,
  openQuestionWindow,
  remainingMs,
  totalDurationSec,
} from "./attempt-timer";

const t0 = new Date("2026-10-07T10:00:00.000Z");
const at = (ms: number) => new Date(t0.getTime() + ms);

describe("openQuestionWindow", () => {
  it("calcule l'expiration à partir de l'affichage", () => {
    expect(openQuestionWindow(t0, 90).expiresAt).toEqual(at(90_000));
  });

  it("applique le tiers-temps", () => {
    expect(openQuestionWindow(t0, 30, 1.5).expiresAt).toEqual(at(45_000));
  });

  it("refuse une durée nulle ou un coefficient inférieur à 1", () => {
    expect(() => openQuestionWindow(t0, 0)).toThrow(RangeError);
    expect(() => openQuestionWindow(t0, 30, 0.5)).toThrow(RangeError);
  });
});

describe("temps restant et expiration", () => {
  const expiresAt = at(60_000);

  it("ne devient jamais négatif", () => {
    expect(remainingMs(expiresAt, at(10_000))).toBe(50_000);
    expect(remainingMs(expiresAt, at(70_000))).toBe(0);
  });

  it("expire exactement à l'échéance", () => {
    expect(isExpired(expiresAt, at(59_999))).toBe(false);
    expect(isExpired(expiresAt, at(60_000))).toBe(true);
  });
});

describe("isAnswerAccepted", () => {
  const expiresAt = at(60_000);

  it("accepte dans la tolérance réseau", () => {
    expect(isAnswerAccepted(expiresAt, at(62_999), 3)).toBe(true);
    expect(isAnswerAccepted(expiresAt, at(63_000), 3)).toBe(true);
  });

  it("refuse au-delà de la tolérance", () => {
    expect(isAnswerAccepted(expiresAt, at(63_001), 3)).toBe(false);
  });
});

describe("totalDurationSec et clockOffsetMs", () => {
  it("additionne les durées des questions", () => {
    expect(totalDurationSec([20, 45, 90])).toBe(155);
    expect(totalDurationSec([30, 30], 1.5)).toBe(90);
  });

  it("estime le décalage d'horloge du client", () => {
    // Client en retard de 5 s, aller-retour de 200 ms.
    expect(clockOffsetMs(10_100, 5_000, 5_200)).toBe(5_000);
  });
});
