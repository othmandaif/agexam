import type { ScalarType } from "./ast";

export interface ArrayValue {
  dims: { lo: number; hi: number }[];
  elem: ScalarType;
  data: (Value | undefined)[];
}

export type Value =
  | { t: "ENTIER" | "REEL"; v: number }
  | { t: "CHAINE" | "CARACTERE"; v: string }
  | { t: "BOOLEEN"; v: boolean }
  | { t: "TABLEAU"; v: ArrayValue };

export const int = (v: number): Value => ({ t: "ENTIER", v });
export const real = (v: number): Value => ({ t: "REEL", v });
export const str = (v: string): Value => ({ t: "CHAINE", v });
export const bool = (v: boolean): Value => ({ t: "BOOLEEN", v });

export const isNumber = (v: Value): v is Extract<Value, { t: "ENTIER" | "REEL" }> =>
  v.t === "ENTIER" || v.t === "REEL";
export const isText = (v: Value): v is Extract<Value, { t: "CHAINE" | "CARACTERE" }> =>
  v.t === "CHAINE" || v.t === "CARACTERE";

/** Affichage d'un réel : 15 (et non 15.0), 4.833333 (6 décimales au plus). */
export function formatReal(n: number): string {
  if (!Number.isFinite(n)) return n > 0 ? "infini" : n < 0 ? "-infini" : "indéfini";
  if (Number.isInteger(n)) return String(n);
  const fixed = Number(n.toFixed(6));
  return String(fixed === 0 ? 0 : fixed);
}

export function formatValue(v: Value | undefined): string {
  if (v === undefined) return "?";
  switch (v.t) {
    case "ENTIER":
      return String(v.v);
    case "REEL":
      return formatReal(v.v);
    case "BOOLEEN":
      return v.v ? "VRAI" : "FAUX";
    case "CHAINE":
    case "CARACTERE":
      return v.v;
    case "TABLEAU":
      return `[${v.v.data.map((x) => formatValue(x)).join(", ")}]`;
  }
}

export const typeLabel = (t: Value["t"]): string =>
  ({
    ENTIER: "un ENTIER",
    REEL: "un REEL",
    CHAINE: "une CHAINE",
    CARACTERE: "un CARACTERE",
    BOOLEEN: "un BOOLEEN",
    TABLEAU: "un TABLEAU",
  })[t];

export function cloneValue(v: Value): Value {
  if (v.t !== "TABLEAU") return v;
  return {
    t: "TABLEAU",
    v: {
      ...v.v,
      dims: v.v.dims.map((d) => ({ ...d })),
      data: v.v.data.map((x) => (x ? cloneValue(x) : x)),
    },
  };
}
