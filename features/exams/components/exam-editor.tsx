"use client";

import { CalendarClock, CircleAlert, Rocket, Save } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FieldError, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { formatTotalDuration } from "@/domain/duration";
import { publishProblems } from "@/domain/exam-lifecycle";
import { parseQuestionText, summarize } from "@/domain/question-text";
import { fieldError, IDLE } from "@/lib/action-state";
import { fromLocalInputValue, toLocalInputValue } from "@/lib/datetime";
import { ROUTES } from "@/lib/routes";
import { useIsClient } from "@/lib/use-is-client";
import { cn } from "@/lib/utils";
import { DEFAULT_EXAM_SETTINGS, type ExamSettings } from "../schemas";
import { saveExamAction } from "../server/actions";
import { QuestionWorkspace } from "./question-workspace";
import { SettingsPanel } from "./settings-panel";

export interface ExamEditorInitial {
  id: string;
  title: string;
  description: string | null;
  moduleId: string | null;
  groupIds: string[];
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
              groupCount: groupIds.size,
              opensAt: opensAt ? new Date(opensAt) : null,
              closesAt: closesAt ? new Date(closesAt) : null,
              questionCount: summary.questionCount,
              questionErrorCount: summary.errorCount,
              totalDurationSec: summary.totalDurationSec,
            },
            new Date(),
          )
        : [],
    [isClient, title, moduleId, groupIds, opensAt, closesAt, summary],
  );

  // Alerte avant de quitter la page avec des modifications non enregistrées.
  const snapshot = JSON.stringify({
    title,
    description,
    moduleId,
    groupIds: [...groupIds].sort(),
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
    groupIds.size === 0 && "au moins un groupe",
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-6">
      <form
        id={FORM_ID}
        action={formAction}
        onSubmit={() => {
          submitting.current = true;
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
        <input type="hidden" name="opensAt" value={opensAt} />
        <input type="hidden" name="closesAt" value={closesAt} />
        <input type="hidden" name="sourceText" value={sourceText} />
        <input type="hidden" name="settings" value={JSON.stringify(settings)} />
      </form>

      {/* 1. Informations */}
      <Card>
        <CardHeader>
          <CardTitle>1. Informations</CardTitle>
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
              Groupes concernés <span className="text-danger">*</span>
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
                        "flex min-h-10 cursor-pointer items-center gap-2 rounded-full border-2 px-4 text-sm font-bold",
                        on
                          ? "border-primary bg-primary-wash text-primary-strong"
                          : "border-line text-ink-soft",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() => toggleGroup(g.id)}
                      />
                      {g.name}
                      <span className="font-semibold text-muted">· {g.memberCount}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <FieldError id="exam-groups-error" message={groupError} />
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
            <div className="flex flex-[1_1_220px] flex-col justify-end gap-1 pb-1 text-sm text-muted">
              <span className="flex items-center gap-2">
                <CalendarClock className="size-4 text-primary" aria-hidden />
                Durée de l&apos;examen :{" "}
                <strong className="text-ink">
                  {formatTotalDuration(summary.totalDurationSec)}
                </strong>
              </span>
              <span>
                Les étudiants peuvent commencer à tout moment entre l&apos;ouverture et la
                fermeture.
              </span>
            </div>
          </div>

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
          <CardTitle>2. Questions et durées</CardTitle>
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
