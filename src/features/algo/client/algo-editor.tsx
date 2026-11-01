"use client";

import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { highlightLine, opensBlock, TOKEN_STYLE } from "./highlight";

export interface AlgoEditorHandle {
  focusLine(line: number): void;
  /** Insère du texte au curseur (clavier visuel). */
  insert(text: string): void;
  /** Insère un modèle de bloc à la ligne du curseur (indenté), « | » = curseur. */
  insertSnippet(template: string): void;
  backspace(): void;
}

/** Bloc ouvert par une ligne → mot de fermeture inséré automatiquement. */
const CLOSERS: { open: RegExp; close: string; closeRe: RegExp }[] = [
  { open: /^SI\b.*\bALORS$/, close: "FINSI", closeRe: /^FIN\s*SI\b/ },
  { open: /^POUR\b.*\bFAIRE$/, close: "FINPOUR", closeRe: /^FIN\s*POUR\b/ },
  { open: /^TANT\s*QUE\b.*\bFAIRE$/, close: "FINTANTQUE", closeRe: /^FIN\s*TANT\s*QUE\b/ },
  { open: /^(REPETER|RÉPÉTER)$/, close: "JUSQU'A ", closeRe: /^JUSQU/ },
];
const norm = (l: string) =>
  l
    .replace(/\/\/.*$/, "")
    .trim()
    .toUpperCase();

/**
 * Éditeur de pseudo-code : zone de texte transparente au-dessus d'une copie
 * colorée (aucune dépendance), numéros de ligne, Tab = 2 espaces, indentation
 * automatique après ALORS / FAIRE / SINON / DEBUT / REPETER.
 */
export const AlgoEditor = forwardRef<
  AlgoEditorHandle,
  {
    value: string;
    onChange: (value: string) => void;
    readOnly?: boolean;
    errorLine?: number | null;
    /** Obsolète : copier / coller est toujours bloqué. */
    blockPaste?: boolean;
    /** Éditeur du formateur (corrigé, code de départ) : copier / coller autorisés. */
    allowClipboard?: boolean;
    minRows?: number;
    ariaLabel?: string;
    onRun?: () => void;
    /** Erreur de syntaxe détectée pendant la frappe (ligne soulignée). */
    lintLine?: number | null;
    /** Taille du texte (px). */
    fontSize?: number;
    /** Position du curseur (barre d'état). */
    onCursor?: (line: number, col: number) => void;
  }
>(function AlgoEditor(
  {
    value,
    onChange,
    readOnly,
    allowClipboard,
    errorLine,
    minRows = 16,
    ariaLabel = "Algorithme",
    onRun,
    lintLine,
    fontSize = 14,
    onCursor,
  },
  ref,
) {
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);
  const lines = useMemo(() => value.split("\n"), [value]);
  const rows = Math.max(minRows, lines.length + 1);
  const lh = Math.round(fontSize * 1.6);
  const [curLine, setCurLine] = useState<number | null>(null);

  const trackCaret = () => {
    const el = areaRef.current;
    if (!el) return;
    const before = value.slice(0, el.selectionStart);
    const line = before.split("\n").length;
    const col = el.selectionStart - (before.lastIndexOf("\n") + 1) + 1;
    setCurLine(line);
    onCursor?.(line, col);
  };

  useImperativeHandle(ref, () => ({
    focusLine(line: number) {
      const el = areaRef.current;
      if (!el) return;
      const start = lines.slice(0, line - 1).reduce((s, l) => s + l.length + 1, 0);
      el.focus();
      el.setSelectionRange(start, start + (lines[line - 1]?.length ?? 0));
      const lh = parseFloat(getComputedStyle(el).lineHeight) || 22;
      el.scrollTop = Math.max(0, (line - 4) * lh);
    },
    insert(raw: string) {
      const el = areaRef.current;
      if (!el || readOnly) return;
      // « | » dans le texte : position du curseur après insertion.
      const mark = raw.indexOf("|");
      const text = mark >= 0 && raw.length > 1 ? raw.replace("|", "") : raw;
      const s = el.selectionStart ?? value.length;
      const e = el.selectionEnd ?? s;
      onChange(value.slice(0, s) + text + value.slice(e));
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = el.selectionEnd =
          s + (mark >= 0 && raw.length > 1 ? mark : text.length);
      });
    },
    insertSnippet(template: string) {
      const el = areaRef.current;
      if (!el || readOnly) return;
      const s = el.selectionStart ?? value.length;
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const lineEnd = value.indexOf("\n", s) === -1 ? value.length : value.indexOf("\n", s);
      const current = value.slice(lineStart, lineEnd);
      const indent = /^\s*/.exec(current)?.[0] ?? "";
      const body = template
        .split("\n")
        .map((l, i) => (i === 0 ? l : indent + l))
        .join("\n");
      const caret = body.indexOf("|");
      const text = body.replace("|", "");
      // Ligne vide : le modèle la remplace ; sinon il s'insère à la ligne suivante.
      const blank = current.trim() === "";
      const insertAt = blank ? lineStart : lineEnd;
      const prefix = blank ? indent : "\n" + indent;
      const next =
        value.slice(0, insertAt) + prefix + text + value.slice(blank ? lineEnd : lineEnd);
      onChange(next);
      requestAnimationFrame(() => {
        el.focus();
        const pos = insertAt + prefix.length + (caret >= 0 ? caret : text.length);
        el.selectionStart = el.selectionEnd = pos;
        trackCaret();
      });
    },
    backspace() {
      const el = areaRef.current;
      if (!el || readOnly) return;
      const s = el.selectionStart ?? value.length;
      const e = el.selectionEnd ?? s;
      const from = s === e ? Math.max(0, s - 1) : s;
      onChange(value.slice(0, from) + value.slice(e));
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = el.selectionEnd = from;
      });
    },
  }));

  const syncScroll = () => {
    const el = areaRef.current;
    if (!el) return;
    if (preRef.current) {
      preRef.current.scrollTop = el.scrollTop;
      preRef.current.scrollLeft = el.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = el.scrollTop;
  };

  const replaceSelection = (el: HTMLTextAreaElement, text: string, caretOffset = text.length) => {
    const { selectionStart: s, selectionEnd: e } = el;
    const next = value.slice(0, s) + text + value.slice(e);
    onChange(next);
    requestAnimationFrame(() => {
      el.selectionStart = el.selectionEnd = s + caretOffset;
    });
  };

  const onKeyDown = (ev: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const el = ev.currentTarget;
    if ((ev.ctrlKey || ev.metaKey) && ev.key === "Enter") {
      ev.preventDefault();
      onRun?.();
      return;
    }
    if (readOnly) return;
    if (ev.key === "Tab") {
      ev.preventDefault();
      const { selectionStart: s, selectionEnd: e } = el;
      if (s === e) {
        replaceSelection(el, "  ");
        return;
      }
      // Indenter / désindenter les lignes sélectionnées
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const block = value.slice(lineStart, e);
      const changed = ev.shiftKey ? block.replace(/^ {1,2}/gm, "") : block.replace(/^/gm, "  ");
      onChange(value.slice(0, lineStart) + changed + value.slice(e));
      requestAnimationFrame(() => {
        el.selectionStart = lineStart;
        el.selectionEnd = lineStart + changed.length;
      });
      return;
    }
    if (ev.key === "Enter") {
      ev.preventDefault();
      const s = el.selectionStart;
      const lineStart = value.lastIndexOf("\n", s - 1) + 1;
      const current = value.slice(lineStart, s);
      const indent = /^\s*/.exec(current)?.[0] ?? "";
      const inner = "\n" + indent + (opensBlock(current) ? "  " : "");
      // Fermeture automatique : SI … ALORS → FINSI, POUR … FAIRE → FINPOUR…
      const rest = value.slice(s);
      const atLineEnd = /^[ \t]*(\n|$)/.test(rest);
      const c = atLineEnd ? CLOSERS.find((x) => x.open.test(norm(current))) : undefined;
      if (c) {
        const all = value.split("\n").map(norm);
        const opened = all.filter((l) => c.open.test(l)).length;
        const closed = all.filter((l) => c.closeRe.test(l)).length;
        if (opened > closed) {
          replaceSelection(el, inner + "\n" + indent + c.close, inner.length);
          return;
        }
      }
      replaceSelection(el, inner);
    }
  };

  return (
    <div
      className="relative flex overflow-hidden rounded-[12px] border border-line bg-[#fbfcfe] font-mono focus-within:border-primary focus-within:shadow-[0_0_0_3px_rgba(49,91,239,0.12)]"
      style={{ fontSize, lineHeight: `${lh}px` }}
    >
      <div
        ref={gutterRef}
        aria-hidden
        className="w-12 shrink-0 overflow-hidden border-r border-line-soft bg-canvas py-3 text-right text-faint select-none"
        style={{ height: rows * lh + 24, fontSize: Math.max(11, fontSize - 2) }}
      >
        {Array.from({ length: rows }, (_, i) => (
          <div
            key={i}
            style={{ height: lh }}
            className={cn(
              "relative pr-2",
              curLine === i + 1 && "bg-primary/[0.07] font-bold text-primary",
              lintLine === i + 1 && "font-bold text-warning",
              errorLine === i + 1 && "bg-danger-bg font-bold text-danger",
            )}
          >
            {lintLine === i + 1 || errorLine === i + 1 ? (
              <span className="absolute top-1/2 left-1.5 size-1.5 -translate-y-1/2 rounded-full bg-current" />
            ) : null}
            {i + 1}
          </div>
        ))}
      </div>
      <div className="relative min-w-0 flex-1" style={{ height: rows * lh + 24 }}>
        <pre
          ref={preRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 m-0 overflow-hidden px-3 py-3 whitespace-pre"
        >
          {lines.map((line, i) => (
            <div
              key={i}
              style={{ minHeight: lh }}
              className={cn(
                curLine === i + 1 && "-mx-3 bg-primary/[0.05] px-3",
                lintLine === i + 1 &&
                  "underline decoration-warning decoration-wavy decoration-1 underline-offset-4",
                errorLine === i + 1 && "-mx-3 bg-danger-bg/70 px-3",
              )}
            >
              {highlightLine(line).map((p, j) => (
                <span key={j} className={TOKEN_STYLE[p.cls]}>
                  {p.text}
                </span>
              ))}
            </div>
          ))}
        </pre>
        <textarea
          ref={areaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          onKeyUp={trackCaret}
          onClick={trackCaret}
          onSelect={trackCaret}
          onFocus={trackCaret}
          onBlur={() => setCurLine(null)}
          // Copier / couper / coller / glisser interdits (examen et entraînement).
          onPaste={(e) => !allowClipboard && e.preventDefault()}
          onDrop={(e) => !allowClipboard && e.preventDefault()}
          onCopy={(e) => !allowClipboard && e.preventDefault()}
          onCut={(e) => !allowClipboard && e.preventDefault()}
          onContextMenu={(e) => !allowClipboard && e.preventDefault()}
          readOnly={readOnly}
          spellCheck={false}
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          aria-label={ariaLabel}
          wrap="off"
          className="absolute inset-0 resize-none overflow-auto bg-transparent px-3 py-3 whitespace-pre text-transparent caret-ink outline-none selection:bg-primary/20"
        />
      </div>
    </div>
  );
});
