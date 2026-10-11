"use client";

import { CalendarClock, Check, CircleAlert, History, Rocket, Save, Undo2 } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatTotalDuration } from "@/domain/duration";
import { examDurationSec, publishProblems } from "@/domain/exam-lifecycle";
import { parseQuestionText, summarize } from "@/domain/question-text";
import { fieldError, IDLE } from "@/lib/action-state";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/datetime";
import { ROUTES } from "@/lib/routes";
import { useIsClient } from "@/lib/use-is-client";
import { cn } from "@/lib/utils";
import { DEFAULT_EXAM_SETTINGS, type ExamSettings, type StudentPick } from "../schemas";
import { saveExamAction } from "../server/actions";
import { CandidatePicker } from "./candidate-picker";
import { QuestionWorkspace } from "./question-workspace";
import { SettingsPanel } from "./settings-panel";

export interface ExamEditorInitial {
  id: string;
  title: string;
  description: string | null;
  moduleId: string | null;
  groupIds: string[];
  candidateIds: string[];
  candidates: StudentPick[];
  opensAt: string | null;
  closesAt: string | null;
  sourceText: string;
  settings: ExamSettings;
  isDraft: boolean;
}

interface ExamEditorProps {
  exam?: ExamEditorInitial;
  modules: { id: string; code: string; name: string }[];
  groups: { id: string; name: string; memberCount: number }[];
  /** Des tentatives existent : questions et durées verrouillées. */
  contentLocked?: boolean;
  isAdmin: boolean;
  /** Nouvel examen prérempli (questions choisies dans la banque). */
  prefill?: { sourceText: string; moduleId: string | null };
}

const FORM_ID = "exam-form";

export function ExamEditor({
  exam,
  modules,
  groups,
  contentLocked = false,
  isAdmin,
  prefill,
}: ExamEditorProps) {
  const isClient = useIsClient();
  const [state, formAction, pending] = useActionState(saveExamAction, IDLE);

  const [title, setTitle] = useState(exam?.title ?? "");
  const [description, setDescription] = useState(exam?.description ?? "");
  const [moduleId, setModuleId] = useState(
    exam?.moduleId ?? prefill?.moduleId ?? (modules.length === 1 ? modules[0]!.id : ""),
  );
  const [groupIds, setGroupIds] = useState<Set<string>>(new Set(exam?.groupIds ?? []));
  const [candidates, setCandidates] = useState<StudentPick[]>(exam?.candidates ?? []);
  // Dates gardées en ISO : la conversion en heure locale se fait dans le navigateur.
  const [opensAt, setOpensAt] = useState(exam?.opensAt ?? "");
  const [closesAt, setClosesAt] = useState(exam?.closesAt ?? "");
  const [sourceText, setSourceText] = useState(exam?.sourceText ?? prefill?.sourceText ?? "");
  const [settings, setSettings] = useState<ExamSettings>(exam?.settings ?? DEFAULT_EXAM_SETTINGS);

  const summary = useMemo(() => summarize(parseQuestionText(sourceText)), [sourceText]);
  const isDraft = exam ? exam.isDraft : true;

  const problems = useMemo(
    () =>
      isClient
        ? publishProblems(
            {
              title,
              moduleId: moduleId || null,
              groupCount: groupIds.size + candidates.length,
              opensAt: opensAt ? new Date(opensAt) : null,
              closesAt: closesAt ? new Date(closesAt) : null,
              questionCount: summary.questionCount,
              questionErrorCount: summary.errorCount,
              totalDurationSec: summary.totalDurationSec,
              timerMode: settings.timerMode,
              globalDurationSec: settings.globalDurationSec,
            },
            new Date(),
          )
        : [],
    [isClient, title, moduleId, groupIds, candidates, opensAt, closesAt, summary, settings],
  );

  // Alerte avant de quitter la page avec des modifications non enregistrées.
  const snapshot = JSON.stringify({
    title,
    description,
    moduleId,
    groupIds: [...groupIds].sort(),
    candidates,
    opensAt,
    closesAt,
    sourceText,
    settings,
  });
  // Prérempli depuis la banque : rien n'est encore enregistré, quitter doit prévenir.
  const [initialSnapshot] = useState(prefill ? "" : snapshot);
  const submitting = useRef(false);
  const dirty = snapshot !== initialSnapshot;
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (!submitting.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ── Brouillon local : rien n'est perdu au rechargement de la page ──────────
  const draftKey = `agexam:exam-draft:${exam?.id ?? "nouveau"}`;
  const [restored, setRestored] = useState(false);
  const restoreChecked = useRef(false);
  useEffect(() => {
    if (restoreChecked.current) return;
    restoreChecked.current = true;
    // Prérempli depuis la banque : choix explicite, on ne restaure pas un ancien brouillon.
    if (prefill) return;
    let draft: DraftData | null = null;
    try {
      const raw = localStorage.getItem(draftKey);
      draft = raw ? (JSON.parse(raw) as DraftData) : null;
    } catch {
      draft = null;
    }
    if (!draft || draft.v !== 1 || draft.snapshot === initialSnapshot) return;
    const d = JSON.parse(draft.snapshot) as SnapshotData;
    /* eslint-disable react-hooks/set-state-in-effect -- restauration unique après hydratation */
    setTitle(d.title);
    setDescription(d.description ?? "");
    setModuleId(d.moduleId);
    setGroupIds(new Set(d.groupIds));
    setCandidates(d.candidates ?? []);
    setOpensAt(d.opensAt);
    setClosesAt(d.closesAt);
    setSourceText(d.sourceText);
    setSettings({ ...DEFAULT_EXAM_SETTINGS, ...d.settings });
    setRestored(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [draftKey, initialSnapshot, prefill]);

  // Sauvegarde 400 ms après la dernière modification (et après un échec d'enregistrement).
  useEffect(() => {
    if (!restoreChecked.current) return;
    const t = setTimeout(() => {
      try {
        if (snapshot === initialSnapshot) localStorage.removeItem(draftKey);
        else
          localStorage.setItem(
            draftKey,
            JSON.stringify({ v: 1, savedAt: Date.now(), snapshot } satisfies DraftData),
          );
      } catch {
        // Stockage plein ou indisponible : l'alerte « non enregistré » reste active.
      }
    }, 400);
    return () => clearTimeout(t);
  }, [snapshot, initialSnapshot, draftKey, state]);

  const discardDraft = () => {
    const d = JSON.parse(initialSnapshot || snapshot) as SnapshotData;
    setTitle(d.title);
    setDescription(d.description ?? "");
    setModuleId(d.moduleId);
    setGroupIds(new Set(d.groupIds));
    setCandidates(d.candidates ?? []);
    setOpensAt(d.opensAt);
    setClosesAt(d.closesAt);
    setSourceText(d.sourceText);
    setSettings(d.settings);
    setRestored(false);
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // ignoré
    }
  };

  const toggleGroup = (id: string) =>
    setGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const titleError = fieldError(state, "title");
  const moduleError = fieldError(state, "moduleId");
  const groupError = fieldError(state, "groupIds");
  /** Minimum pour enregistrer, même en brouillon. */
  const saveBlockers = [
    title.trim().length < 3 && "nom de l'examen",
    !moduleId && "module",
    groupIds.size + candidates.length === 0 && "au moins un groupe ou un étudiant",
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-6">
      <form
        id={FORM_ID}
        action={formAction}
        onSubmit={() => {
          submitting.current = true;
          // Enregistré côté serveur : le brouillon local n'est plus utile
          // (réécrit automatiquement si l'enregistrement échoue).
          try {
            localStorage.removeItem(draftKey);
          } catch {
            // ignoré
          }
        }}
        className="hidden"
      >
        {exam ? <input type="hidden" name="examId" value={exam.id} /> : null}
        <input type="hidden" name="title" value={title} />
        <input type="hidden" name="description" value={description} />
        <input type="hidden" name="moduleId" value={moduleId} />
        {[...groupIds].map((id) => (
          <input key={id} type="hidden" name="groupId" value={id} />
        ))}
        {candidates.map((c) => (
          <input key={c.id} type="hidden" name="candidateId" value={c.id} />
        ))}
        <input type="hidden" name="opensAt" value={opensAt} />
        <input type="hidden" name="closesAt" value={closesAt} />
        <input type="hidden" name="sourceText" value={sourceText} />
        <input type="hidden" name="settings" value={JSON.stringify(settings)} />
      </form>

      {restored ? (
        <div
          role="status"
          className="animate-fade-in flex flex-wrap items-center justify-between gap-3 rounded-card border border-primary/25 bg-primary-wash px-4 py-3 text-[14px]"
        >
          <span className="flex items-center gap-2.5 text-primary-strong">
            <History className="size-4 shrink-0" aria-hidden />
            Vos modifications non enregistrées ont été restaurées (questions comprises).
          </span>
          <Button type="button" size="sm" variant="ghost" onClick={discardDraft}>
            <Undo2 aria-hidden />{" "}
            {exam ? "Revenir à la version enregistrée" : "Repartir d'un examen vide"}
          </Button>
        </div>
      ) : null}

      {/* 1. Informations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Step n={1} /> Informations
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-[2_1_320px] flex-col gap-2">
              <Label htmlFor="exam-title">
                Nom de l&apos;examen <span className="text-danger">*</span>
              </Label>
              <Input
                id="exam-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ex. M104 · Contrôle n°2 — Boucles"
                className="h-11"
                maxLength={160}
                aria-invalid={titleError ? true : undefined}
              />
              <FieldError id="exam-title-error" message={titleError} />
            </div>
            <div className="flex flex-[1_1_220px] flex-col gap-2">
              <Label htmlFor="exam-module">
                Module <span className="text-danger">*</span>
              </Label>
              {modules.length > 0 ? (
                <Select
                  id="exam-module"
                  value={moduleId}
                  onChange={(e) => setModuleId(e.target.value)}
                  aria-invalid={moduleError ? true : undefined}
                >
                  <option value="">Choisir…</option>
                  {modules.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} · {m.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="rounded-field bg-warning-bg px-3 py-2.5 text-sm text-warning">
                  Aucun module.{" "}
                  {isAdmin ? (
                    <Link href={ROUTES.admin.referential} className="font-bold">
                      Créer un module
                    </Link>
                  ) : (
                    "Demandez à l'administrateur d'en créer un."
                  )}
                </p>
              )}
              <FieldError id="exam-module-error" message={moduleError} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold">
              Groupes concernés{" "}
              <span className="font-normal text-muted">(ou des étudiants ajoutés ci-dessous)</span>
            </span>
            {groups.length === 0 ? (
              <p className="text-sm text-muted">
                Aucun groupe.{" "}
                <Link href={ROUTES.trainer.groups} className="font-bold">
                  Créer un groupe
                </Link>
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {groups.map((g) => {
                  const on = groupIds.has(g.id);
                  return (
                    <label
                      key={g.id}
                      className={cn(
                        "relative flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] border px-3.5 text-sm font-semibold transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary",
                        on
                          ? "border-primary bg-primary-wash text-primary shadow-[0_0_0_1px_var(--color-primary)]"
                          : "border-line bg-surface text-ink-soft hover:bg-canvas",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() => toggleGroup(g.id)}
                      />
                      {on ? <Check className="size-4" aria-hidden /> : null}
                      {g.name}
                      <span className="font-semibold text-muted">· {g.memberCount}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <FieldError id="exam-groups-error" message={groupError} />
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-bold">
              Étudiants ajoutés{" "}
              <span className="font-normal text-muted">
                (rattrapage, cas particuliers : même hors des groupes choisis)
              </span>
            </span>
            <CandidatePicker value={candidates} onChange={setCandidates} />
          </div>

          <div className="flex flex-wrap gap-4">
            <DateTimeField
              id="exam-opens"
              label="Ouverture"
              iso={opensAt}
              onChange={setOpensAt}
              ready={isClient}
            />
            <DateTimeField
              id="exam-closes"
              label="Fermeture"
              iso={closesAt}
              onChange={setClosesAt}
              ready={isClient}
            />
          </div>

          <TimerField
            mode={settings.timerMode}
            globalDurationSec={settings.globalDurationSec}
            questionsTotalSec={summary.totalDurationSec}
            disabled={contentLocked}
            onChange={(timerMode, globalDurationSec) =>
              setSettings((s) => ({ ...s, timerMode, globalDurationSec }))
            }
          />

          <div className="flex flex-col gap-2">
            <Label htmlFor="exam-description">
              Consignes{" "}
              <span className="font-normal text-muted">(facultatif, affichées avant le début)</span>
            </Label>
            <textarea
              id="exam-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
              className="w-full rounded-field border border-line bg-surface px-4 py-3 text-[15px] focus:border-primary focus:shadow-[0_0_0_3px_#dfe3ff] focus:outline-none"
            />
          </div>
        </CardContent>
      </Card>

      {/* 2. Questions et durées */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Step n={2} /> Questions et durées
          </CardTitle>
          <CardDescription>
            Écrivez ou collez les questions à gauche, ou importez un fichier. Réglez la durée de
            chaque question dans l&apos;aperçu à droite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <QuestionWorkspace
            text={sourceText}
            onTextChange={setSourceText}
            locked={contentLocked}
            moduleId={moduleId || null}
            globalTimer={settings.timerMode === "GLOBAL"}
          />
        </CardContent>
      </Card>

      {/* 3. Réglages */}
      <SettingsPanel value={settings} onChange={setSettings} />

      {/* Barre d'action */}
      <div className="sticky bottom-0 z-20 -mx-8 border-t border-line bg-surface/95 backdrop-blur max-sm:-mx-4">
        <div className="flex flex-wrap items-center gap-3 px-8 py-3 max-sm:px-4">
          <div className="min-w-0 flex-[1_1_320px] text-sm">
            {state.status === "error" ? (
              <FormMessage state={state} className="py-2" />
            ) : saveBlockers.length > 0 ? (
              <span className="flex items-center gap-2 font-semibold text-warning">
                <CircleAlert className="size-4" aria-hidden />
                Pour enregistrer : {saveBlockers.join(", ")}.
              </span>
            ) : problems.length > 0 ? (
              <div className="text-muted">
                <p className="flex items-center gap-2 font-semibold text-warning">
                  <CircleAlert className="size-4 text-warning" aria-hidden />
                  {isDraft ? "Avant de publier" : "À corriger"} : {problems.length} point
                  {problems.length > 1 ? "s" : ""}
                </p>
                <ul className="mt-1 max-h-28 list-disc overflow-y-auto pl-6">
                  {problems.map((p) => (
                    <li key={p}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : (
              <span className="font-semibold text-success">
                {isDraft ? "Prêt à publier." : "Tout est en ordre."}
              </span>
            )}
          </div>
          {dirty ? (
            <span className="text-xs text-muted">Modifications non enregistrées</span>
          ) : null}
          {isDraft ? (
            <>
              <Button
                type="submit"
                form={FORM_ID}
                name="intent"
                value="save"
                variant="outline"
                disabled={pending || saveBlockers.length > 0}
              >
                <Save aria-hidden /> {pending ? "Enregistrement…" : "Enregistrer le brouillon"}
              </Button>
              <Button
                type="submit"
                form={FORM_ID}
                name="intent"
                value="publish"
                variant="mint"
                disabled={pending || problems.length > 0}
                title={problems.length > 0 ? problems.join("\n") : undefined}
              >
                <Rocket aria-hidden /> Publier
              </Button>
            </>
          ) : (
            <Button
              type="submit"
              form={FORM_ID}
              name="intent"
              value="save"
              variant="mint"
              disabled={pending || problems.length > 0}
            >
              <Save aria-hidden /> {pending ? "Enregistrement…" : "Enregistrer les modifications"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function DateTimeField({
  id,
  label,
  iso,
  onChange,
  ready,
}: {
  id: string;
  label: string;
  iso: string;
  onChange: (iso: string) => void;
  /** Rendu côté navigateur uniquement : l'heure locale dépend du fuseau. */
  ready: boolean;
}) {
  return (
    <div className="flex flex-[1_1_220px] flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="datetime-local"
        className="h-11"
        disabled={!ready}
        value={ready ? toLocalInputValue(iso) : ""}
        onChange={(e) => onChange(fromLocalInputValue(e.target.value))}
      />
    </div>
  );
}

/** Choix du chrono : par question (durées du texte) ou durée globale. */
function TimerField({
  mode,
  globalDurationSec,
  questionsTotalSec,
  disabled,
  onChange,
}: {
  mode: ExamSettings["timerMode"];
  globalDurationSec: number | null;
  questionsTotalSec: number;
  disabled: boolean;
  onChange: (mode: ExamSettings["timerMode"], globalDurationSec: number | null) => void;
}) {
  const minutes = globalDurationSec ? Math.round(globalDurationSec / 60) : "";
  const effective = examDurationSec(mode, globalDurationSec, questionsTotalSec);
  const choices = [
    {
      id: "PAR_QUESTION" as const,
      title: "Chrono par question",
      hint: "Chaque question a sa durée (ligne DUREE du texte).",
    },
    {
      id: "GLOBAL" as const,
      title: "Durée globale",
      hint: "Un seul chrono pour tout l'examen, questions dans l'ordre.",
    },
  ];
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-bold">
        Chrono <span className="text-danger">*</span>
      </span>
      <div role="radiogroup" aria-label="Mode de chrono" className="flex flex-wrap gap-3">
        {choices.map((c) => {
          const on = mode === c.id;
          return (
            <button
              key={c.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={disabled}
              onClick={() =>
                onChange(
                  c.id,
                  c.id === "GLOBAL"
                    ? (globalDurationSec ?? Math.max(60, Math.ceil(questionsTotalSec / 60) * 60))
                    : globalDurationSec,
                )
              }
              className={cn(
                "flex min-w-[240px] flex-[1_1_240px] flex-col gap-0.5 rounded-card border px-4 py-3 text-left transition-colors disabled:opacity-60",
                on
                  ? "border-primary bg-primary-wash shadow-[0_0_0_1px_var(--color-primary)]"
                  : "border-line bg-surface hover:bg-canvas",
              )}
            >
              <span className="text-[14px] font-bold text-ink">{c.title}</span>
              <span className="text-[13px] text-muted">{c.hint}</span>
            </button>
          );
        })}
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted">
        {mode === "GLOBAL" ? (
          <label className="flex items-center gap-2 font-semibold text-ink">
            Durée globale
            <Input
              type="number"
              min={1}
              max={360}
              inputMode="numeric"
              value={minutes}
              disabled={disabled}
              onChange={(e) => {
                const n = Number(e.target.value);
                onChange("GLOBAL", Number.isFinite(n) && n > 0 ? Math.round(n) * 60 : null);
              }}
              className="h-10 w-24"
              aria-label="Durée globale en minutes"
            />
            minutes
          </label>
        ) : null}
        <span className="flex items-center gap-2">
          <CalendarClock className="size-4 text-primary" aria-hidden />
          Durée de l&apos;examen :{" "}
          <strong className="text-ink">{formatTotalDuration(effective)}</strong>
        </span>
        <span>
          Les étudiants peuvent commencer à tout moment entre l&apos;ouverture et la fermeture.
        </span>
      </div>
    </div>
  );
}

/** Numéro d'étape des sections de l'éditeur. */
function Step({ n }: { n: number }) {
  return (
    <span
      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-bold text-white"
      aria-hidden
    >
      {n}
    </span>
  );
}

interface SnapshotData {
  title: string;
  description: string;
  moduleId: string;
  groupIds: string[];
  candidates: StudentPick[];
  opensAt: string;
  closesAt: string;
  sourceText: string;
  settings: ExamSettings;
}

interface DraftData {
  v: 1;
  savedAt: number;
  snapshot: string;
}
