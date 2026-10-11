import { describe, expect, it } from "vitest";
import { canonicalQuestion } from "./question-fingerprint";

const base = {
  prompt: "Capitale du Maroc ?",
  code: null,
  codeLanguage: null,
  explanation: null,
  options: [
    { label: "Rabat", isCorrect: true },
    { label: "Fès", isCorrect: false },
  ],
};

describe("canonicalQuestion", () => {
  it("identique pour le même contenu", () => {
    expect(canonicalQuestion(base)).toBe(
      canonicalQuestion({ ...base, options: [...base.options] }),
    );
  });

  it("change si la bonne réponse, l'ordre, le code ou l'explication changent", () => {
    const ref = canonicalQuestion(base);
    expect(
      canonicalQuestion({
        ...base,
        options: [
          { label: "Rabat", isCorrect: false },
          { label: "Fès", isCorrect: true },
        ],
      }),
    ).not.toBe(ref);
    expect(canonicalQuestion({ ...base, options: [...base.options].reverse() })).not.toBe(ref);
    expect(canonicalQuestion({ ...base, code: "x" })).not.toBe(ref);
    expect(canonicalQuestion({ ...base, explanation: "Car…" })).not.toBe(ref);
  });

  it("une option fixe se distingue d'une option mélangée", () => {
    const fixed = {
      ...base,
      options: [base.options[0]!, { label: "Fès", isCorrect: false, fixedPosition: true }],
    };
    expect(canonicalQuestion(fixed)).not.toBe(canonicalQuestion(base));
  });
});
