import { describe, expect, it } from "vitest";
import {
  formatReceiptCode,
  isMultipleAnswer,
  planAttempt,
  questionDeadline,
  resolveExpiredQuestion,
  selectionError,
} from "./attempt-rules";

const questions = Array.from({ length: 6 }, (_, i) => ({
  id: `q${i}`,
  options: [
    { id: `q${i}a` },
    { id: `q${i}b` },
    { id: `q${i}c` },
    { id: `q${i}none`, fixedPosition: true },
  ],
}));

describe("planAttempt", () => {
  it("garde toutes les questions, numérotées de 0 à n-1", () => {
    const plan = planAttempt(questions, { shuffleAnswers: true });
    expect(plan.map((p) => p.position)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(plan.map((p) => p.examQuestionId).sort()).toEqual(questions.map((q) => q.id));
  });

  it("garde l'option fixe en dernier et ne mélange pas les réponses si désactivé", () => {
    for (const p of planAttempt(questions, { shuffleAnswers: true })) {
      expect(p.optionOrder[3]).toMatch(/none$/);
    }
    const plain = planAttempt(questions, { shuffleAnswers: false });
    for (const p of plain) {
      const q = questions.find((x) => x.id === p.examQuestionId)!;
      expect(p.optionOrder).toEqual(q.options.map((o) => o.id));
    }
  });

  it("produit des ordres différents d'un étudiant à l'autre", () => {
    const orders = new Set(
      Array.from({ length: 30 }, () =>
        planAttempt(questions, { shuffleAnswers: false })
          .map((p) => p.examQuestionId)
          .join(","),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });
});

describe("questionDeadline", () => {
  const shown = new Date("2026-10-07T10:00:00Z");
  it("applique la durée et le tiers-temps", () => {
    expect(questionDeadline(shown, 60, 1.5, null).toISOString()).toBe("2026-10-07T10:01:30.000Z");
  });
  it("ne dépasse pas la fermeture de l'examen", () => {
    const close = new Date("2026-10-07T10:00:20Z");
    expect(questionDeadline(shown, 60, 1, close)).toEqual(close);
  });
});

describe("resolveExpiredQuestion", () => {
  const base = {
    shownAt: new Date("2026-10-07T10:00:00Z"),
    expiresAt: new Date("2026-10-07T10:01:00Z"),
    heartbeatIntervalSec: 10,
    neutralizationsUsed: 0,
    maxNeutralizations: 1,
  };

  it("compte la réponse enregistrée", () => {
    expect(resolveExpiredQuestion({ ...base, selectedCount: 1, lastSeenAt: null }).outcome).toBe(
      "REPONDUE",
    );
  });

  it("perd la question si l'étudiant était connecté sans répondre", () => {
    const r = resolveExpiredQuestion({
      ...base,
      selectedCount: 0,
      lastSeenAt: new Date("2026-10-07T10:00:55Z"),
    });
    expect(r).toEqual({ outcome: "EXPIREE", connectionLost: false });
  });

  it("neutralise en cas de coupure, dans la limite autorisée", () => {
    const lost = { ...base, selectedCount: 0, lastSeenAt: new Date("2026-10-07T10:00:05Z") };
    expect(resolveExpiredQuestion(lost)).toEqual({ outcome: "NEUTRALISEE", connectionLost: true });
    expect(resolveExpiredQuestion({ ...lost, neutralizationsUsed: 1 })).toEqual({
      outcome: "EXPIREE",
      connectionLost: true,
    });
  });
});

describe("sélection et reçu", () => {
  it("valide une sélection", () => {
    expect(selectionError(["a"], ["a", "b"], false)).toBeNull();
    expect(selectionError(["a", "b"], ["a", "b"], false)).toBe("Une seule réponse possible.");
    expect(selectionError(["a", "b"], ["a", "b"], true)).toBeNull();
    expect(selectionError(["x"], ["a", "b"], true)).toBe("Réponse inconnue.");
    expect(selectionError(["a", "a"], ["a"], true)).toBe("Réponse en double.");
  });

  it("détecte les réponses multiples", () => {
    expect(isMultipleAnswer([{ isCorrect: true }, { isCorrect: true }])).toBe(true);
    expect(isMultipleAnswer([{ isCorrect: true }, { isCorrect: false }])).toBe(false);
  });

  it("formate un reçu", () => {
    expect(formatReceiptCode(new Uint8Array([0xa7, 0xf3, 0x91, 0xc2]))).toBe("A7F3-91C2");
  });
});
