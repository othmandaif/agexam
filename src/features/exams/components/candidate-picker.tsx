"use client";

import { LoaderCircle, Search, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { cn } from "@/lib/utils";
import type { StudentPick } from "../schemas";
import { searchStudentsAction } from "../server/actions";

/**
 * Étudiants ajoutés un par un, en plus des groupes (rattrapage, cas particuliers).
 * Recherche par nom ou e-mail dans tout l'établissement.
 */
export function CandidatePicker({
  value,
  onChange,
}: {
  value: StudentPick[];
  onChange: (next: StudentPick[]) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<StudentPick[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pending, start] = useTransition();
  const boxRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seq = useRef(0);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const search = (term: string) => {
    if (timer.current) clearTimeout(timer.current);
    if (term.trim().length < 2) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      const n = ++seq.current;
      start(async () => {
        const rows = await searchStudentsAction(
          term,
          value.map((s) => s.id),
        );
        // Réponse d'une frappe plus ancienne : ignorée.
        if (n === seq.current) {
          setResults(rows);
          setActive(0);
        }
      });
    }, 250);
  };

  const add = (s: StudentPick) => {
    onChange([...value, s].sort((a, b) => a.fullName.localeCompare(b.fullName, "fr")));
    setResults((r) => r.filter((x) => x.id !== s.id));
    setQ("");
    setOpen(false);
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div ref={boxRef} className="relative max-w-xl">
        <label className="relative block">
          <span className="sr-only">Rechercher un étudiant à ajouter</span>
          {pending ? (
            <LoaderCircle className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-primary" />
          ) : (
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
          )}
          <input
            type="search"
            value={q}
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls="candidate-results"
            aria-autocomplete="list"
            placeholder="Nom ou e-mail d'un étudiant (2 lettres minimum)…"
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
              search(e.target.value);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(e) => {
              if (!results.length) return;
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(results.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                const s = results[active];
                if (s) add(s);
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            className="h-11 w-full rounded-field border border-[#e2e8f0] bg-surface pr-3 pl-9 text-[14px] transition-colors duration-150 outline-none hover:border-[#cbd5e1] focus:border-primary focus:shadow-[0_0_0_3px_rgba(49,91,239,0.15)]"
          />
        </label>
        {open && q.trim().length >= 2 ? (
          <ul
            id="candidate-results"
            role="listbox"
            className="animate-fade-in absolute top-full right-0 left-0 z-20 mt-1 max-h-72 overflow-y-auto rounded-[12px] border border-line bg-surface p-1.5 shadow-[0_12px_32px_rgba(13,33,72,0.16)]"
          >
            {results.length === 0 ? (
              <li className="px-3 py-2.5 text-[13.5px] text-muted">
                {pending ? "Recherche…" : "Aucun étudiant trouvé."}
              </li>
            ) : (
              results.map((s, i) => (
                <li key={s.id} role="option" aria-selected={i === active}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => add(s)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-[8px] px-3 py-2 text-left transition-colors duration-150",
                      i === active ? "bg-primary-wash" : "hover:bg-canvas",
                    )}
                  >
                    <UserPlus className="size-4 shrink-0 text-primary" aria-hidden />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-ink">
                        {s.fullName}
                      </span>
                      <span className="block truncate text-[12.5px] text-muted">
                        {s.email}
                        {s.groups ? ` · ${s.groups}` : " · sans groupe"}
                      </span>
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        ) : null}
      </div>

      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Étudiants ajoutés">
          {value.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-[10px] border border-primary/30 bg-primary-wash py-1.5 pr-1.5 pl-3 text-[13px]"
            >
              <span className="font-semibold text-primary">{s.fullName}</span>
              {s.groups ? <span className="text-muted">· {s.groups}</span> : null}
              <button
                type="button"
                onClick={() => onChange(value.filter((x) => x.id !== s.id))}
                aria-label={`Retirer ${s.fullName}`}
                className="flex size-6 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-white hover:text-danger"
              >
                <X className="size-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
