import "server-only";
import type { ExamDetail } from "./queries";
import type { ExamEditorInitial } from "../components/exam-editor";
import { DEFAULT_EXAM_SETTINGS } from "../schemas";

/** Convertit un examen enregistré en valeurs initiales de l'éditeur. */
export function toEditorInitial(exam: ExamDetail): ExamEditorInitial {
  return {
    id: exam.id,
    title: exam.title,
    description: exam.description,
    moduleId: exam.moduleId,
    groupIds: exam.groups.map((g) => g.id),
    candidateIds: exam.candidates.map((c) => c.id),
    candidates: exam.candidates,
    opensAt: exam.opensAt?.toISOString() ?? null,
    closesAt: exam.closesAt?.toISOString() ?? null,
    sourceText: exam.sourceText ?? "",
    settings: {
      violationPolicy: exam.violationPolicy,
      resultVisibility: exam.resultVisibility,
      resultReleaseMode: exam.resultReleaseMode,
      shuffleAnswers: exam.securitySettings?.shuffleAnswers ?? DEFAULT_EXAM_SETTINGS.shuffleAnswers,
      blockCopyPaste: exam.securitySettings?.blockCopyPaste ?? DEFAULT_EXAM_SETTINGS.blockCopyPaste,
      validateAlgoGrades: exam.securitySettings?.validateAlgoGrades ?? true,
      isPractice: exam.isPractice,
      timerMode: exam.timerMode,
      globalDurationSec: exam.globalDurationSec,
    },
    isDraft: exam.status === "BROUILLON",
  };
}
