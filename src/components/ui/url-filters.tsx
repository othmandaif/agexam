"use client";

import { LoaderCircle, Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUrlParams } from "@/lib/use-url-params";
import { Select } from "./select";

/**
 * Recherche liée à l'URL (?q=), envoyée 350 ms après la frappe.
 * Le bouton ✕ (ou Échap) efface la recherche et ramène à la page où l'on
 * était avant de chercher.
 */
export function UrlSearch({
  param = "q",
  placeholder,
  label,
}: {
  param?: string;
  placeholder: string;
  label: string;
}) {
  const { params, set, pending } = useUrlParams();
  const [value, setValue] = useState(params.get(param) ?? "");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Page affichée avant le début de la recherche (restaurée à l'annulation). */
  const pageBefore = useRef<string | null>(params.get(param) ? null : params.get("page"));
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const apply = (v: string) => {
    const term = v.trim();
    const current = params.get(param) ?? "";
    if (!current && term) pageBefore.current = params.get("page");
    if (!term) {
      // Fin de recherche : retour à la page d'avant.
      set({ [param]: null, page: pageBefore.current }, false);
      pageBefore.current = null;
    } else {
      set({ [param]: term });
    }
  };

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    setValue("");
    apply("");
  };

  return (
    <label className="relative min-w-0 flex-[1_1_240px]">
      <span className="sr-only">{label}</span>
      {pending ? (
        <LoaderCircle className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin text-primary" />
      ) : (
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
      )}
      <input
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          setValue(v);
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(() => apply(v), 350);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape" && value) {
            e.preventDefault();
            clear();
          }
        }}
        className="h-11 w-full rounded-field border border-[#e2e8f0] bg-surface pr-10 pl-9 text-[14px] transition-colors duration-150 outline-none hover:border-[#cbd5e1] focus:border-primary focus:shadow-[0_0_0_3px_rgba(49,91,239,0.15)] [&::-webkit-search-cancel-button]:hidden"
      />
      {value ? (
        <button
          type="button"
          onClick={clear}
          aria-label="Effacer la recherche"
          title="Effacer la recherche (Échap)"
          className="absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-muted transition-colors duration-150 hover:bg-canvas hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}
    </label>
  );
}

/** Liste déroulante liée à un paramètre d'URL (vide = tous). */
export function UrlSelect({
  param,
  label,
  allLabel,
  options,
}: {
  param: string;
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  const { params, set } = useUrlParams();
  return (
    <div className="min-w-0 flex-[1_1_200px]">
      <Select
        aria-label={label}
        value={params.get(param) ?? ""}
        onChange={(e) => set({ [param]: e.target.value })}
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </Select>
    </div>
  );
}
