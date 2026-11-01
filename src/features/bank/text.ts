import { buildQuestionText } from "@/domain/question-text";
import type { BankQuestion } from "./types";

/** Texte au format AGExam pour des questions de la banque (durée et points suggérés). */
export function bankQuestionsToText(items: readonly BankQuestion[]): string {
  return buildQuestionText(
    items.map((q) => ({
      prompt: q.prompt,
      code: q.code,
      codeLanguage: q.codeLanguage,
      options: q.options,
      durationSec: q.suggestedDurationSec,
      points: q.defaultPoints,
      explanation: q.explanation,
      algo: q.algo,
    })),
  );
}
