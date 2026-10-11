import { Badge } from "@/components/ui/badge";
import { PHASE_LABELS, type ExamPhase } from "@/domain/exam-lifecycle";

const TONE: Record<ExamPhase, "neutral" | "info" | "success" | "warning" | "danger"> = {
  BROUILLON: "neutral",
  PLANIFIE: "info",
  OUVERT: "success",
  FERME: "neutral",
  ARCHIVE: "neutral",
};

export function ExamPhaseBadge({ phase }: { phase: ExamPhase }) {
  return (
    <Badge tone={TONE[phase]}>
      {phase === "OUVERT" ? (
        <span className="size-2 rounded-full bg-mint-strong" aria-hidden />
      ) : null}
      {PHASE_LABELS[phase]}
    </Badge>
  );
}
