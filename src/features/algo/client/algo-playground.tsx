"use client";

import {
  CircleAlert,
  CircleCheck,
  CornerDownLeft,
  Keyboard,
  Maximize2,
  Minimize2,
  LoaderCircle,
  Play,
  Square,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlgoSession,
  compile,
  type AlgoErrorInfo,
  type OutputSegment,
  type SessionState,
} from "@/domain/agsyntax";
import { cn } from "@/lib/utils";
import { AlgoEditor, type AlgoEditorHandle } from "./algo-editor";
import { VisualKeyboard } from "./visual-keyboard";

type Phase =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "input"; varName: string; varType: string }
  | { kind: "done"; steps: number }
  | { kind: "error"; error: AlgoErrorInfo }
  | { kind: "stopped" };

/** Modèles insérés à la ligne du curseur (« | » = position du curseur). */
const SNIPPETS = [
  {
    label: "Squelette",
    title: "ALGORITHME … VARIABLES … DEBUT … FIN",
    code: "ALGORITHME Nom\nVARIABLES\n  |\nDEBUT\n  \nFIN",
  },
  { label: "LIRE", title: "Lire une valeur", code: "LIRE(|)", inline: true },
  { label: "ECRIRE", title: "Afficher", code: 'ECRIRE("|")', inline: true },
  { label: "<-", title: "Affectation", code: " <- |", inline: true },
  { label: "SI", title: "SI … ALORS … FINSI", code: "SI | ALORS\n  \nFINSI" },
  {
    label: "SI/SINON",
    title: "SI … ALORS … SINON … FINSI",
    code: "SI | ALORS\n  \nSINON\n  \nFINSI",
  },
  { label: "POUR", title: "Boucle POUR", code: "POUR i DE 1 A | FAIRE\n  \nFINPOUR" },
  { label: "TANT QUE", title: "Boucle TANT QUE", code: "TANT QUE | FAIRE\n  \nFINTANTQUE" },
  { label: "REPETER", title: "REPETER … JUSQU'A", code: "REPETER\n  |\nJUSQU'A " },
] as const;

/**
 * Éditeur + console : « Exécuter » lance l'algorithme dans le navigateur,
 * chaque LIRE ouvre une saisie dans la console, les erreurs pointent la ligne.
 */
export function AlgoPlayground({
  value,
  onChange,
  readOnly,
  blockPaste,
  actions,
  minRows,
  onRunComplete,
}: {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
  blockPaste?: boolean;
  /** Boutons supplémentaires (Soumettre…), à droite d'Exécuter. */
  actions?: React.ReactNode;
  minRows?: number;
  onRunComplete?: (ok: boolean) => void;
}) {
  const [segments, setSegments] = useState<OutputSegment[]>([]);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [answer, setAnswer] = useState("");
  const [keyboard, setKeyboard] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [wide, setWide] = useState(false);
  const [cursor, setCursor] = useState<{ line: number; col: number } | null>(null);
  // Vérification de la syntaxe pendant la frappe (après une courte pause).
  const [lint, setLint] = useState<AlgoErrorInfo | null>(null);
  const [linted, setLinted] = useState(false);
  useEffect(() => {
    if (!value.trim()) {
      const t = setTimeout(() => {
        setLint(null);
        setLinted(false);
      }, 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      const r = compile(value);
      setLint(r.ok ? null : r.error);
      setLinted(true);
    }, 700);
    return () => clearTimeout(t);
  }, [value]);
  const sessionRef = useRef<AlgoSession | null>(null);
  const editorRef = useRef<AlgoEditorHandle>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  const [tick, setTick] = useState(0);
  const onCompleteRef = useRef(onRunComplete);
  useEffect(() => {
    onCompleteRef.current = onRunComplete;
  }, [onRunComplete]);

  /** Reporte l'état de la session dans l'interface. */
  const apply = (session: AlgoSession, state: SessionState) => {
    setSegments(session.segments.map((x) => ({ ...x })));
    switch (state.status) {
      case "running":
        setPhase({ kind: "running" });
        setTick((t) => t + 1);
        break;
      case "input":
        setPhase({ kind: "input", varName: state.varName, varType: state.varType });
        requestAnimationFrame(() => inputRef.current?.focus());
        break;
      case "done":
        setPhase({ kind: "done", steps: session.steps });
        onCompleteRef.current?.(true);
        break;
      case "error":
        setPhase({ kind: "error", error: state.error });
        onCompleteRef.current?.(false);
        break;
      case "stopped":
        setPhase({ kind: "stopped" });
        break;
    }
  };

  // Exécution par tranches : la page reste réactive (bouton Arrêter).
  useEffect(() => {
    const session = sessionRef.current;
    if (phase.kind !== "running" || !session) return;
    const id = setTimeout(() => apply(session, session.advance()), 0);
    return () => clearTimeout(id);
  }, [tick, phase.kind]);

  useEffect(() => {
    const el = consoleRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [segments, phase]);

  const run = () => {
    const session = new AlgoSession(value);
    sessionRef.current = session;
    setAnswer("");
    apply(session, session.state.status === "error" ? session.state : session.advance());
  };

  const stop = () => {
    sessionRef.current?.stop();
    if (sessionRef.current) apply(sessionRef.current, sessionRef.current.state);
  };

  /** Pas de <form> : l'éditeur peut être placé dans un formulaire (Entrée le soumettrait). */
  const submitAnswer = () => {
    const session = sessionRef.current;
    if (!session || phase.kind !== "input") return;
    const v = answer;
    setAnswer("");
    apply(session, session.advance(v));
  };

  const busy = phase.kind === "running" || phase.kind === "input";
  const errorLine = phase.kind === "error" ? phase.error.line : null;

  return (
    <div
      className={cn(
        "grid gap-4",
        wide ? "grid-cols-1" : "xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]",
      )}
    >
      <div className="flex min-w-0 flex-col gap-2">
        <div
          className="flex flex-wrap items-center gap-1.5 rounded-[12px] border border-line-soft bg-canvas px-2 py-1.5"
          role="toolbar"
          aria-label="Insérer une structure"
        >
          <span className="px-1 text-[11.5px] font-bold tracking-wide text-muted uppercase">
            Insérer
          </span>
          {SNIPPETS.map((sn) => (
            <button
              key={sn.label}
              type="button"
              disabled={readOnly}
              title={sn.title}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                "inline" in sn
                  ? editorRef.current?.insert(sn.code)
                  : editorRef.current?.insertSnippet(sn.code)
              }
              className="rounded-md border border-line bg-surface px-2 py-1 font-mono text-[12px] font-semibold text-primary-strong transition-colors hover:border-primary/50 hover:bg-lilac disabled:opacity-40"
            >
              {sn.label}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-1">
            <button
              type="button"
              onClick={() => setFontSize((f) => Math.max(12, f - 1))}
              className="rounded-md px-2 py-1 text-[12px] font-bold text-muted hover:bg-surface"
              aria-label="Réduire le texte"
            >
              A−
            </button>
            <button
              type="button"
              onClick={() => setFontSize((f) => Math.min(20, f + 1))}
              className="rounded-md px-2 py-1 text-[13px] font-bold text-muted hover:bg-surface"
              aria-label="Agrandir le texte"
            >
              A+
            </button>
            <button
              type="button"
              onClick={() => setWide((w) => !w)}
              className="rounded-md p-1.5 text-muted hover:bg-surface max-xl:hidden"
              aria-label={wide ? "Éditeur et console côte à côte" : "Agrandir l'éditeur"}
              title={wide ? "Côte à côte" : "Agrandir l'éditeur"}
            >
              {wide ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
          </span>
        </div>
        <AlgoEditor
          ref={editorRef}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          blockPaste={blockPaste}
          errorLine={errorLine}
          lintLine={errorLine ? null : (lint?.line ?? null)}
          fontSize={fontSize}
          onCursor={(line, col) => setCursor({ line, col })}
          minRows={minRows}
          onRun={busy ? undefined : run}
        />
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[12.5px]"
          aria-live="polite"
        >
          {!linted ? (
            <span className="text-muted">
              Écrivez votre algorithme : la syntaxe est vérifiée pendant la frappe.
            </span>
          ) : lint ? (
            <button
              type="button"
              onClick={() => lint.line && editorRef.current?.focusLine(lint.line)}
              className="flex min-w-0 items-center gap-1.5 text-left font-semibold text-warning hover:underline"
            >
              <CircleAlert className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">
                {lint.line ? `Ligne ${lint.line} : ` : ""}
                {lint.message}
              </span>
            </button>
          ) : (
            <span className="flex items-center gap-1.5 font-semibold text-success">
              <CircleCheck className="size-3.5" aria-hidden /> Syntaxe correcte
            </span>
          )}
          <span className="ml-auto text-muted tabular-nums">
            {cursor ? `Ligne ${cursor.line}, col. ${cursor.col} · ` : ""}
            {value ? value.split("\n").length : 0} ligne{value.split("\n").length > 1 ? "s" : ""}
          </span>
        </div>
        {keyboard ? (
          <VisualKeyboard
            disabled={readOnly}
            onInsert={(t) => editorRef.current?.insert(t)}
            onBackspace={() => editorRef.current?.backspace()}
          />
        ) : null}
        <div className="flex flex-wrap items-center gap-2.5">
          {busy ? (
            <Button variant="danger" onClick={stop}>
              <Square aria-hidden /> Arrêter
            </Button>
          ) : (
            <Button variant="outline" onClick={run} title="Exécuter (Ctrl + Entrée)">
              <Play aria-hidden /> Exécuter
            </Button>
          )}
          {actions}
          <Button
            variant={keyboard ? "soft" : "ghost"}
            size="sm"
            onClick={() => setKeyboard((k) => !k)}
            aria-pressed={keyboard}
            title="Clavier visuel (symboles, chiffres, lettres)"
          >
            <Keyboard aria-hidden /> Clavier
          </Button>
          <span className="ml-auto text-xs text-muted max-sm:hidden">
            Ctrl + Entrée pour exécuter
          </span>
        </div>
      </div>

      <section
        aria-label="Console"
        className="flex min-h-[320px] min-w-0 flex-col overflow-hidden rounded-[12px] border border-[#1e293b] bg-[#0f172a] text-[#e2e8f0] shadow-soft"
      >
        <header className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-2 text-[12.5px] font-semibold text-[#94a3b8]">
          <span className="flex items-center gap-2">
            {phase.kind === "running" ? (
              <LoaderCircle className="size-3.5 animate-spin text-[#7ea3ff]" aria-hidden />
            ) : phase.kind === "done" ? (
              <CircleCheck className="size-3.5 text-[#34d399]" aria-hidden />
            ) : phase.kind === "error" ? (
              <CircleAlert className="size-3.5 text-[#f87171]" aria-hidden />
            ) : null}
            Console
            {phase.kind === "done" ? <span className="font-normal">· terminé</span> : null}
            {phase.kind === "stopped" ? <span className="font-normal">· arrêté</span> : null}
            {phase.kind === "input" ? (
              <span className="font-normal text-[#fbbf24]">· en attente d&apos;une saisie</span>
            ) : null}
          </span>
          <button
            type="button"
            onClick={() => {
              if (busy) return;
              setSegments([]);
              setPhase({ kind: "idle" });
            }}
            disabled={busy}
            aria-label="Effacer la console"
            className="rounded p-1 transition-colors hover:bg-white/10 disabled:opacity-40"
          >
            <Trash2 className="size-3.5" aria-hidden />
          </button>
        </header>
        <div
          ref={consoleRef}
          className="flex-1 overflow-auto px-4 py-3 font-mono text-[13px] leading-[21px]"
          aria-live="polite"
        >
          {phase.kind === "idle" && segments.length === 0 ? (
            <p className="text-[#64748b]">
              Cliquez sur « Exécuter » : la sortie de votre algorithme s&apos;affichera ici.
            </p>
          ) : null}
          <pre className="m-0 break-words whitespace-pre-wrap">
            {segments.map((s, i) => (
              <span key={i} className={cn(s.kind === "in" && "font-bold text-[#7ea3ff]")}>
                {s.text}
              </span>
            ))}
          </pre>
          {phase.kind === "input" ? (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-[#fbbf24]">›</span>
              <input
                ref={inputRef}
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    e.stopPropagation();
                    submitAnswer();
                  }
                }}
                aria-label={`Valeur de ${phase.varName} (${phase.varType})`}
                placeholder={`${phase.varName} (${phase.varType})`}
                className="min-w-0 flex-1 rounded border border-white/15 bg-white/5 px-2 py-1 font-mono text-[13px] text-white outline-none placeholder:text-[#64748b] focus:border-[#7ea3ff]"
              />
              <button
                type="button"
                onClick={submitAnswer}
                className="rounded bg-[#315bef] px-2.5 py-1 text-[12px] font-bold text-white"
                aria-label="Valider la saisie"
              >
                <CornerDownLeft className="size-3.5" aria-hidden />
              </button>
            </div>
          ) : null}
          {phase.kind === "error" ? (
            <div className="mt-3 rounded-[10px] border border-[#f87171]/40 bg-[#7f1d1d]/40 px-3 py-2.5 font-sans text-[13px]">
              <p className="font-bold text-[#fecaca]">
                {phase.error.kind === "syntax"
                  ? "Erreur d'écriture"
                  : phase.error.kind === "input"
                    ? "Saisie"
                    : "Erreur à l'exécution"}
                {phase.error.line ? (
                  <button
                    type="button"
                    onClick={() => editorRef.current?.focusLine(phase.error.line!)}
                    className="ml-1.5 font-bold text-[#fca5a5] underline underline-offset-2"
                  >
                    ligne {phase.error.line}
                  </button>
                ) : null}
              </p>
              <p className="mt-0.5 text-[#fee2e2]">{phase.error.message}</p>
              {phase.error.hint ? (
                <p className="mt-1 text-[#fca5a5]">💡 {phase.error.hint}</p>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
