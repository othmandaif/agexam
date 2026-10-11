"use client";

import { CopyButton } from "@/components/ui/copy-button";
import { bankQuestionsToText } from "../text";
import type { BankQuestion } from "../types";

export function CopyQuestionText({ question }: { question: BankQuestion }) {
  return (
    <CopyButton
      value={bankQuestionsToText([question])}
      label="Copier le texte"
      variant="outline"
      size="sm"
    />
  );
}
