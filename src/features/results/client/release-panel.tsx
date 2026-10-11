"use client";

import { Eye, EyeOff, Send } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage } from "@/components/ui/form";
import { Select } from "@/components/ui/select";
import {
  RESULT_RELEASE_MODES,
  RESULT_VISIBILITIES,
  type ResultReleaseMode,
  type ResultVisibility,
} from "@/domain/enums";
import { RELEASE_LABELS, VISIBILITY_LABELS } from "@/features/exams/schemas";
import { useActionRunner } from "@/lib/use-action-runner";
import { cn } from "@/lib/utils";
import { publishResultsAction, resultSettingsAction } from "../server/actions";
import type { ExamResults } from "../types";
import { LocalTime } from "@/components/ui/local-time";

/** Ce que voient les étudiants, quand, et le bouton « Envoyer les notes ». */
export function ReleasePanel({ exam }: { exam: ExamResults["exam"] }) {
  const [visibility, setVisibility] = useState<ResultVisibility>(exam.resultVisibility);
  const [releaseMode, setReleaseMode] = useState<ResultReleaseMode>(exam.resultReleaseMode);
  const { state, pending, run } = useActionRunner();
  const dirty = visibility !== exam.resultVisibility || releaseMode !== exam.resultReleaseMode;
  const visible = exam.studentSees !== "AUCUNE";
  const published = exam.resultReleaseMode === "MANUEL" && exam.resultsPublishedAt !== null;
  const closesAt = exam.closesAt ? new Date(exam.closesAt) : null;

  let status: string;
  if (exam.resultVisibility === "AUCUNE") {
    status = "Les étudiants voient seulement leur reçu de soumission.";
  } else if (visible) {
    status = `Les étudiants voient : ${VISIBILITY_LABELS[exam.studentSees].title.toLowerCase()}.`;
    if (exam.resultVisibility === "CORRECTION" && exam.studentSees !== "CORRECTION") {
      status += " La correction complète s'affichera après la fermeture.";
    }
  } else if (exam.resultReleaseMode === "APRES_FERMETURE") {
    status = "Visibles automatiquement à la fermeture.";
  } else {
    status = "Pas encore visibles par les étudiants.";
  }

  return (
    <section className="flex flex-col gap-4 rounded-card border border-line bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "mt-0.5 grid size-9 shrink-0 place-items-center rounded-full",
              visible ? "bg-success-bg text-success" : "bg-neutral-bg text-neutral",
            )}
            aria-hidden
          >
            {visible ? <Eye className="size-5" /> : <EyeOff className="size-5" />}
          </span>
          <div className="flex flex-col">
            <h2 className="font-display text-lg font-bold">Notes des étudiants</h2>
            <p className="text-sm text-muted">
              {status}
              {!visible && exam.resultReleaseMode === "APRES_FERMETURE" && closesAt ? (
                <>
                  {" "}
                  (<LocalTime date={closesAt} withDate />)
                </>
              ) : null}
              {published && exam.resultsPublishedAt ? (
                <>
                  {" "}
                  Notes envoyées à <LocalTime date={exam.resultsPublishedAt} />.
                </>
              ) : null}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {visible ? (
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (
                  window.confirm("Retirer les résultats ? Les étudiants ne verront plus leur note.")
                )
                  run(() => publishResultsAction(exam.id, false));
              }}
            >
              <EyeOff aria-hidden />
              Retirer
            </Button>
          ) : exam.resultVisibility !== "AUCUNE" ? (
            <Button
              variant="mint"
              size="sm"
              disabled={pending || exam.status === "BROUILLON"}
              onClick={() => run(() => publishResultsAction(exam.id, true))}
            >
              <Send aria-hidden />
              Envoyer les notes
            </Button>
          ) : null}
        </div>
      </div>

      <form
        className="grid items-end gap-3 border-t border-line-soft pt-4 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => resultSettingsAction(exam.id, { visibility, releaseMode }));
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Ce qu&apos;ils voient
          <Select
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as ResultVisibility)}
          >
            {RESULT_VISIBILITIES.map((v) => (
              <option key={v} value={v}>
                {VISIBILITY_LABELS[v].title} · {VISIBILITY_LABELS[v].hint}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Quand
          <Select
            value={releaseMode}
            onChange={(e) => setReleaseMode(e.target.value as ResultReleaseMode)}
          >
            {RESULT_RELEASE_MODES.map((m) => (
              <option key={m} value={m}>
                {RELEASE_LABELS[m]}
              </option>
            ))}
          </Select>
        </label>
        <Button type="submit" variant="outline" disabled={!dirty || pending}>
          Enregistrer
        </Button>
      </form>
      <FormMessage state={state} />
    </section>
  );
}
