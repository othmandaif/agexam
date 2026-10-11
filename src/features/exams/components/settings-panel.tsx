"use client";

import { GraduationCap, Settings2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { RESULT_RELEASE_MODES, RESULT_VISIBILITIES, type SanctionType } from "@/domain/enums";
import { cn } from "@/lib/utils";
import { RELEASE_LABELS, VISIBILITY_LABELS, type ExamSettings } from "../schemas";

const SANCTIONS: { value: SanctionType; label: string }[] = [
  { value: "AUCUNE", label: "Rien (journalisé seulement)" },
  { value: "AVERTISSEMENT", label: "Avertissement" },
  { value: "INVALIDER_QUESTION", label: "Invalider la question en cours" },
  { value: "SOUMISSION_AUTO", label: "Soumission automatique" },
];

interface SettingsPanelProps {
  value: ExamSettings;
  onChange: (value: ExamSettings) => void;
}

export function SettingsPanel({ value, onChange }: SettingsPanelProps) {
  const set = <K extends keyof ExamSettings>(key: K, v: ExamSettings[K]) =>
    onChange({ ...value, [key]: v });

  // Sanctions par question : 1re sortie, puis 2e sortie et suivantes sur la même question.
  const policy = [0, 1].map(
    (i) => value.violationPolicy[i] ?? value.violationPolicy.at(-1) ?? "INVALIDER_QUESTION",
  );

  return (
    <details className="group rounded-card border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 px-6 py-5">
        <Settings2 className="size-5 text-primary" aria-hidden />
        <span className="font-display text-lg font-bold">Réglages avancés</span>
        <span className="text-sm text-muted">
          {value.isPractice ? "Entraînement · " : ""}
          {VISIBILITY_LABELS[value.resultVisibility].title} ·{" "}
          {RELEASE_LABELS[value.resultReleaseMode].toLowerCase()} · sanctions par question
        </span>
        <span className="ml-auto text-sm font-bold text-primary group-open:hidden">Modifier</span>
      </summary>

      <div className="flex flex-col gap-8 border-t border-line px-6 py-6">
        <label
          className={cn(
            "flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4",
            value.isPractice ? "border-primary bg-primary-wash" : "border-line",
          )}
        >
          <input
            type="checkbox"
            className="mt-0.5 size-5 accent-primary"
            checked={value.isPractice}
            onChange={(e) => set("isPractice", e.target.checked)}
          />
          <span className="flex flex-col gap-1">
            <span className="flex items-center gap-2 font-bold">
              <GraduationCap className="size-4 text-primary" aria-hidden />
              Examen d&apos;entraînement
            </span>
            <span className="text-sm text-muted">
              Pour réviser : sans code d&apos;accès ni plein écran, aucune sanction, tentatives
              illimitées. Après chaque question, l&apos;étudiant voit la correction et
              l&apos;explication. Les sanctions ci-dessous sont ignorées.
            </span>
          </span>
        </label>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-bold">
            Ce que l&apos;étudiant voit après l&apos;examen
          </legend>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
            {RESULT_VISIBILITIES.map((v) => (
              <label
                key={v}
                className={cn(
                  "flex cursor-pointer flex-col gap-1 rounded-xl border-2 p-3",
                  value.resultVisibility === v ? "border-primary bg-primary-wash" : "border-line",
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="resultVisibility"
                    className="size-4 accent-primary"
                    checked={value.resultVisibility === v}
                    onChange={() => set("resultVisibility", v)}
                  />
                  <strong className="text-sm">{VISIBILITY_LABELS[v].title}</strong>
                </span>
                <span className="text-xs text-muted">{VISIBILITY_LABELS[v].hint}</span>
              </label>
            ))}
          </div>
          <div
            className="flex flex-wrap gap-1 rounded-full bg-canvas p-1"
            role="radiogroup"
            aria-label="Moment de publication des résultats"
          >
            {RESULT_RELEASE_MODES.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={value.resultReleaseMode === m}
                onClick={() => set("resultReleaseMode", m)}
                className={cn(
                  "min-h-10 flex-[1_1_140px] rounded-full text-sm font-bold",
                  value.resultReleaseMode === m
                    ? "bg-surface text-primary-strong shadow-[0_2px_4px_rgba(40,46,62,0.1)]"
                    : "text-ink-soft",
                )}
              >
                {RELEASE_LABELS[m]}
              </button>
            ))}
          </div>
          <p className="text-xs text-muted">
            La correction complète n&apos;est jamais montrée avant la fermeture de l&apos;examen.
          </p>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-bold">
            Sorties du mode examen, comptées par question
          </legend>
          <p className="-mt-1 text-xs text-muted">
            Le compteur repart à zéro à chaque nouvelle question.
          </p>
          {policy.map((sanction, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3">
              <Label htmlFor={`policy-${i}`} className="w-40 font-semibold">
                {i === 0 ? "1re sortie" : "2e sortie et suivantes"}
              </Label>
              <div className="flex-[0_1_320px]">
                <Select
                  id={`policy-${i}`}
                  value={sanction}
                  onChange={(e) => {
                    const next = [...policy];
                    next[i] = e.target.value as SanctionType;
                    set("violationPolicy", next);
                  }}
                >
                  {SANCTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          ))}
          <p className="text-xs text-muted">
            Les événements à moins de 2 s d&apos;intervalle comptent pour une seule violation. Vous
            pourrez annuler une sanction pendant le suivi.
          </p>
        </fieldset>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-1 text-sm font-bold">Options</legend>
          <label className="flex items-center justify-between gap-4 text-sm font-semibold">
            Mélanger aussi l&apos;ordre des réponses
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={value.shuffleAnswers}
              onChange={(e) => set("shuffleAnswers", e.target.checked)}
            />
          </label>
          <label className="flex items-center justify-between gap-4 text-sm font-semibold">
            Bloquer copier, coller et clic droit
            <input
              type="checkbox"
              className="size-5 accent-primary"
              checked={value.blockCopyPaste}
              onChange={(e) => set("blockCopyPaste", e.target.checked)}
            />
          </label>
          <p className="text-xs text-muted">
            L&apos;ordre des questions est toujours mélangé, et la navigation est linéaire (pas de
            retour en arrière).
          </p>
        </fieldset>
      </div>
    </details>
  );
}
