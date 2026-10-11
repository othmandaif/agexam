import { describe, expect, it } from "vitest";
import { DEFAULT_VIOLATION_POLICY } from "./exam-settings";
import { isViolationEvent, sanctionFor, shouldMergeIntoIncident } from "./violations";

describe("isViolationEvent", () => {
  it("sanctionne la sortie du plein écran et les absences d'au moins 2 s", () => {
    expect(isViolationEvent("NETWORK_LOST", 60_000)).toBe(false);
    expect(isViolationEvent("FULLSCREEN_EXIT")).toBe(true);
    expect(isViolationEvent("PAGE_RELOAD", 60_000)).toBe(false);
    expect(isViolationEvent("WINDOW_BLUR", 1_500)).toBe(false);
    expect(isViolationEvent("WINDOW_BLUR")).toBe(false);
    expect(isViolationEvent("WINDOW_BLUR", 2_000)).toBe(true);
    expect(isViolationEvent("VISIBILITY_HIDDEN", 5_000)).toBe(true);
  });
});

describe("shouldMergeIntoIncident", () => {
  const last = new Date("2026-10-07T10:00:00.000Z");

  it("fusionne les événements dans la fenêtre", () => {
    expect(shouldMergeIntoIncident(last, new Date(last.getTime() + 1_500), 2_000)).toBe(true);
  });

  it("crée un nouvel incident hors fenêtre ou sans incident précédent", () => {
    expect(shouldMergeIntoIncident(last, new Date(last.getTime() + 2_500), 2_000)).toBe(false);
    expect(shouldMergeIntoIncident(null, last, 2_000)).toBe(false);
  });
});

describe("sanctionFor", () => {
  it("par défaut (par question) : avertissement puis invalidation", () => {
    expect(sanctionFor(DEFAULT_VIOLATION_POLICY, 1)).toBe("AVERTISSEMENT");
    expect(sanctionFor(DEFAULT_VIOLATION_POLICY, 2)).toBe("INVALIDER_QUESTION");
    expect(sanctionFor(DEFAULT_VIOLATION_POLICY, 3)).toBe("INVALIDER_QUESTION");
  });

  it("applique la dernière sanction au-delà de la politique", () => {
    const policy = ["AVERTISSEMENT", "INVALIDER_QUESTION", "SOUMISSION_AUTO"] as const;
    expect(sanctionFor([...policy], 3)).toBe("SOUMISSION_AUTO");
    expect(sanctionFor([...policy], 7)).toBe("SOUMISSION_AUTO");
  });

  it("refuse un numéro invalide", () => {
    expect(() => sanctionFor(DEFAULT_VIOLATION_POLICY, 0)).toThrow(RangeError);
  });
});
