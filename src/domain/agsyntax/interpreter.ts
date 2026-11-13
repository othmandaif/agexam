import type {
  ConstDecl,
  Expr,
  LValue,
  Program,
  Routine,
  ScalarType,
  Stmt,
  TypeSpec,
  VarDecl,
} from "./ast";
import { AlgoError } from "./errors";
import {
  bool,
  cloneValue,
  formatReal,
  formatValue,
  int,
  isNumber,
  isText,
  real,
  str,
  typeLabel,
  type ArrayValue,
  type Value,
} from "./values";

// ── Requêtes vers l'appelant (saisie, respiration de l'interface) ─────────
export type MachineRequest =
  { type: "input"; varName: string; varType: string; line: number } | { type: "tick" };

export interface MachineLimits {
  maxSteps: number;
  maxOutputChars: number;
  maxDepth: number;
  /** Une « respiration » (tick) toutes les N étapes. */
  tickEvery: number;
}

export const DEFAULT_LIMITS: MachineLimits = {
  maxSteps: 2_000_000,
  maxOutputChars: 200_000,
  maxDepth: 400,
  tickEvery: 20_000,
};

export interface OutputSegment {
  kind: "out" | "in";
  text: string;
}

// ── Cases mémoire ─────────────────────────────────────────────────────────
interface Cell {
  name: string;
  type: TypeSpec;
  isConst: boolean;
  get(): Value | undefined;
  set(v: Value): void;
}

class VarCell implements Cell {
  isConst = false;
  constructor(
    public name: string,
    public type: TypeSpec,
    private value: Value | undefined,
  ) {}
  get() {
    return this.value;
  }
  set(v: Value) {
    this.value = v;
  }
}

class ConstCell implements Cell {
  isConst = true;
  constructor(
    public name: string,
    public type: TypeSpec,
    private readonly value: Value,
  ) {}
  get() {
    return this.value;
  }
  set() {
    throw new Error("constante");
  }
}

/** Case d'un tableau passée par référence (VAR). */
class ElemCell implements Cell {
  isConst = false;
  constructor(
    public name: string,
    public type: TypeSpec,
    private readonly arr: ArrayValue,
    private readonly index: number,
  ) {}
  get() {
    return this.arr.data[this.index];
  }
  set(v: Value) {
    this.arr.data[this.index] = v;
  }
}

class ReturnSignal {
  constructor(public readonly value: Value | undefined) {}
}

interface Frame {
  routine: Routine | null;
  locals: Map<string, Cell>;
  /** Fonction : valeur affectée à son nom (« Nom <- valeur »). */
  result?: Value;
}

function fail(line: number | null, message: string, hint?: string): never {
  throw new AlgoError("runtime", line, message, hint);
}

const typeName = (t: TypeSpec): string =>
  t.kind === "scalar" ? t.name : t.kind === "array" ? `TABLEAU DE ${t.elem}` : "quelconque";

// ── Analyse statique (avant exécution) ───────────────────────────────────
interface LoopInfo {
  condVars: Set<string>;
  modified: Set<string>;
  hasUserCall: boolean;
  hasReturn: boolean;
}

function collectExprVars(
  e: Expr,
  out: Set<string>,
  calls: { user: boolean },
  routines: Map<string, Routine>,
) {
  switch (e.kind) {
    case "var":
      out.add(e.key);
      break;
    case "index":
      out.add(e.key);
      e.indices.forEach((i) => collectExprVars(i, out, calls, routines));
      break;
    case "call":
      if (routines.has(e.key)) calls.user = true;
      e.args.forEach((a) => collectExprVars(a, out, calls, routines));
      break;
    case "unary":
      collectExprVars(e.expr, out, calls, routines);
      break;
    case "binary":
      collectExprVars(e.left, out, calls, routines);
      collectExprVars(e.right, out, calls, routines);
      break;
    default:
      break;
  }
}

function collectModified(
  stmts: Stmt[],
  out: Set<string>,
  flags: { user: boolean; ret: boolean },
  routines: Map<string, Routine>,
) {
  const visitExpr = (e: Expr) => {
    const dummy = new Set<string>();
    const c = { user: false };
    collectExprVars(e, dummy, c, routines);
    if (c.user) flags.user = true;
  };
  for (const s of stmts) {
    switch (s.kind) {
      case "assign":
        out.add(s.target.key);
        visitExpr(s.value);
        break;
      case "read":
        s.targets.forEach((t) => out.add(t.key));
        break;
      case "for":
        out.add(s.var.key);
        collectModified(s.body, out, flags, routines);
        break;
      case "if":
        visitExpr(s.cond);
        collectModified(s.then, out, flags, routines);
        if (s.else) collectModified(s.else, out, flags, routines);
        break;
      case "while":
      case "repeat":
        visitExpr(s.cond);
        collectModified(s.body, out, flags, routines);
        break;
      case "call":
        if (routines.has(s.key)) flags.user = true;
        s.args.forEach(visitExpr);
        break;
      case "return":
        flags.ret = true;
        break;
      case "write":
        s.args.forEach(visitExpr);
        break;
      default:
        break;
    }
  }
}

export function exprToString(e: Expr): string {
  const prec: Record<string, number> = {
    OU: 1,
    ET: 2,
    "=": 4,
    "<>": 4,
    "<": 4,
    ">": 4,
    "<=": 4,
    ">=": 4,
    "+": 5,
    "-": 5,
    "*": 6,
    "/": 6,
    DIV: 6,
    MOD: 6,
    "^": 8,
  };
  const go = (x: Expr, parent: number): string => {
    switch (x.kind) {
      case "num":
        return x.isReal ? formatReal(x.value) : String(x.value);
      case "str":
        return x.isChar ? `'${x.value}'` : `"${x.value}"`;
      case "bool":
        return x.value ? "VRAI" : "FAUX";
      case "var":
        return x.name;
      case "index":
        return `${x.name}[${x.indices.map((i) => go(i, 0)).join(", ")}]`;
      case "call":
        return `${x.name}(${x.args.map((a) => go(a, 0)).join(", ")})`;
      case "unary": {
        const s = x.op === "NON" ? `NON ${go(x.expr, 3)}` : `-${go(x.expr, 7)}`;
        return parent > (x.op === "NON" ? 3 : 7) ? `(${s})` : s;
      }
      case "binary": {
        const p = prec[x.op] ?? 0;
        const s = `${go(x.left, p)} ${x.op} ${go(x.right, p + 1)}`;
        return p < parent ? `(${s})` : s;
      }
    }
  };
  return go(e, 0);
}

// ── Machine ───────────────────────────────────────────────────────────────
export class Machine {
  readonly segments: OutputSegment[] = [];
  steps = 0;
  private outChars = 0;
  private depth = 0;
  private readonly globals = new Map<string, Cell>();
  private readonly loopCache = new WeakMap<Stmt, LoopInfo>();
  private frame: Frame;
  /** Appelé avant chaque instruction (animation pas à pas, indices). */
  onStmt: ((s: Stmt) => void) | null = null;

  constructor(
    private readonly program: Program,
    private readonly limits: MachineLimits = DEFAULT_LIMITS,
    private readonly random: () => number = Math.random,
  ) {
    this.frame = { routine: null, locals: this.globals };
  }

  get output(): string {
    return this.segments.map((s) => s.text).join("");
  }

  // ── sortie ──────────────────────────────────────────────────────────────
  private emit(text: string, kind: "out" | "in" = "out") {
    if (!text) return;
    this.outChars += text.length;
    if (this.outChars > this.limits.maxOutputChars) {
      throw new AlgoError(
        "limit",
        null,
        "Trop de texte affiché : l'exécution est arrêtée (boucle infinie probable).",
      );
    }
    const last = this.segments[this.segments.length - 1];
    if (last && last.kind === kind) last.text += text;
    else this.segments.push({ kind, text });
  }

  private *step(line: number): Generator<MachineRequest, void, string | undefined> {
    this.steps++;
    if (this.steps > this.limits.maxSteps) {
      throw new AlgoError(
        "limit",
        line,
        `L'exécution a dépassé ${this.limits.maxSteps.toLocaleString("fr-FR")} étapes : elle est arrêtée.`,
        "Vérifiez que chaque boucle se rapproche de sa condition d'arrêt.",
      );
    }
    if (this.steps % this.limits.tickEvery === 0) yield { type: "tick" };
  }

  // ── déclarations ────────────────────────────────────────────────────────
  private evalConst(c: ConstDecl, scope: Map<string, Cell>) {
    const v = this.evalStatic(c.value);
    const typed = c.type ? this.coerce(v, { kind: "scalar", name: c.type }, c.line, c.name) : v;
    scope.set(
      c.key,
      new ConstCell(c.name, c.type ? { kind: "scalar", name: c.type } : { kind: "any" }, typed),
    );
  }

  /** Expression sans effet ni saisie (constantes, bornes de tableau). */
  private evalStatic(e: Expr): Value {
    const gen = this.evalExpr(e);
    for (;;) {
      const r = gen.next();
      if (r.done) return r.value;
      if (r.value.type === "input") fail(e.line, "Une déclaration ne peut pas lire de valeur.");
    }
  }

  private makeVar(d: { name: string; type: TypeSpec; line: number }): Cell {
    if (d.type.kind === "array") {
      if (!d.type.dims)
        fail(
          d.line,
          `Le tableau ${d.name} doit avoir des bornes : TABLEAU[1..10] DE ${d.type.elem}.`,
        );
      const dims = d.type.dims.map(({ lo, hi }) => {
        const l = this.evalStatic(lo);
        const h = this.evalStatic(hi);
        if (l.t !== "ENTIER" || h.t !== "ENTIER")
          fail(d.line, `Les bornes du tableau ${d.name} doivent être des entiers.`);
        if (h.v < l.v)
          fail(
            d.line,
            `Tableau ${d.name} : la borne haute (${h.v}) est plus petite que la borne basse (${l.v}).`,
          );
        return { lo: l.v, hi: h.v };
      });
      const size = dims.reduce((s, x) => s * (x.hi - x.lo + 1), 1);
      if (size > 1_000_000) fail(d.line, `Tableau ${d.name} trop grand (${size} cases).`);
      const arr: ArrayValue = { dims, elem: d.type.elem, data: new Array(size).fill(undefined) };
      return new VarCell(d.name, d.type, { t: "TABLEAU", v: arr });
    }
    return new VarCell(d.name, d.type, undefined);
  }

  private declare(vars: VarDecl[], consts: ConstDecl[], scope: Map<string, Cell>) {
    for (const c of consts) {
      if (scope.has(c.key)) fail(c.line, `« ${c.name} » est déclaré deux fois.`);
      this.evalConst(c, scope);
    }
    for (const v of vars) {
      if (scope.has(v.key)) fail(v.line, `« ${v.name} » est déclaré deux fois.`);
      scope.set(v.key, this.makeVar(v));
    }
  }

  // ── résolution ──────────────────────────────────────────────────────────
  private lookup(key: string): Cell | undefined {
    return this.frame.locals.get(key) ?? this.globals.get(key);
  }

  private cellOf(name: string, key: string, line: number): Cell {
    const c = this.lookup(key);
    if (!c) {
      if (this.program.routines.has(key)) {
        fail(
          line,
          `${name} est un sous-programme, pas une variable : appelez-le avec des parenthèses.`,
        );
      }
      fail(
        line,
        `La variable « ${name} » n'est pas déclarée.`,
        "Déclarez-la dans VARIABLES, avant DEBUT.",
      );
    }
    return c;
  }

  // ── conversions et contrôles de type ────────────────────────────────────
  private coerce(v: Value, type: TypeSpec, line: number, target: string): Value {
    if (type.kind === "any") return v;
    if (type.kind === "array") {
      if (v.t !== "TABLEAU")
        fail(line, `${target} est un tableau : il ne peut pas recevoir ${typeLabel(v.t)}.`);
      return v;
    }
    const want = type.name;
    switch (want) {
      case "ENTIER":
        if (v.t === "ENTIER") return v;
        if (v.t === "REEL") {
          if (Number.isInteger(v.v)) return int(v.v);
          fail(
            line,
            `${target} est un ENTIER : il ne peut pas recevoir le réel ${formatReal(v.v)}.`,
            "Utilisez DIV pour une division entière, ou ENT() / ARRONDI().",
          );
        }
        break;
      case "REEL":
        if (isNumber(v)) return real(v.v);
        break;
      case "CHAINE":
        if (isText(v)) return str(v.v);
        break;
      case "CARACTERE":
        if (isText(v) && [...v.v].length === 1) return { t: "CARACTERE", v: v.v };
        if (isText(v))
          fail(
            line,
            `${target} est un CARACTERE : il ne peut contenir qu'une seule lettre, pas « ${v.v} ».`,
          );
        break;
      case "BOOLEEN":
        if (v.t === "BOOLEEN") return v;
        break;
    }
    fail(
      line,
      `${target} est de type ${want} : il ne peut pas recevoir ${typeLabel(v.t)}${v.t === "TABLEAU" ? "" : ` (${formatValue(v)})`}.`,
      v.t === "ENTIER" || v.t === "REEL"
        ? want === "CHAINE"
          ? "Pour transformer un nombre en texte, utilisez CHAINE(nombre)."
          : undefined
        : undefined,
    );
  }

  private parseInput(raw: string, type: TypeSpec, target: string, line: number): Value {
    const text = raw.trim();
    const t = type.kind === "scalar" ? type.name : type.kind === "array" ? type.elem : "CHAINE";
    switch (t) {
      case "ENTIER":
        if (/^[+-]?\d+$/.test(text)) return int(Number(text));
        throw new AlgoError(
          "input",
          line,
          `Saisie refusée : « ${raw} » n'est pas un ENTIER (variable ${target}).`,
          "Tapez un nombre entier, sans virgule, par exemple 12.",
        );
      case "REEL":
        if (/^[+-]?(\d+([.,]\d*)?|[.,]\d+)$/.test(text))
          return real(Number(text.replace(",", ".")));
        throw new AlgoError(
          "input",
          line,
          `Saisie refusée : « ${raw} » n'est pas un nombre REEL (variable ${target}).`,
          "Exemple : 12.5",
        );
      case "BOOLEEN": {
        const up = text.toUpperCase();
        if (up === "VRAI" || up === "FAUX") return bool(up === "VRAI");
        throw new AlgoError(
          "input",
          line,
          `Saisie refusée : « ${raw} » n'est pas un BOOLEEN (variable ${target}).`,
          "Tapez VRAI ou FAUX.",
        );
      }
      case "CARACTERE":
        if ([...raw].length === 1) return { t: "CARACTERE", v: raw };
        throw new AlgoError(
          "input",
          line,
          `Saisie refusée : un CARACTERE est une seule lettre (variable ${target}).`,
        );
      default:
        return str(raw);
    }
  }

  // ── tableaux ────────────────────────────────────────────────────────────
  private *arrayIndex(
    e: Extract<Expr, { kind: "index" }>,
  ): Generator<MachineRequest, { arr: ArrayValue; at: number; label: string }, string | undefined> {
    const cell = this.cellOf(e.name, e.key, e.line);
    const v = cell.get();
    if (!v || v.t !== "TABLEAU") {
      if (v && isText(v) && e.indices.length === 1) {
        fail(
          e.line,
          `${e.name} est une chaîne : pour sa i-ème lettre, utilisez CAR(${e.name}, i).`,
        );
      }
      fail(e.line, `${e.name} n'est pas un tableau : on ne peut pas écrire ${e.name}[…].`);
    }
    const arr = v.v;
    if (e.indices.length !== arr.dims.length) {
      fail(
        e.line,
        `${e.name} a ${arr.dims.length} dimension${arr.dims.length > 1 ? "s" : ""} : écrivez ${e.name}[${arr.dims.map((_, i) => "i" + (i + 1)).join(", ")}].`,
      );
    }
    const idx: number[] = [];
    for (const ie of e.indices) {
      const iv = yield* this.evalExpr(ie);
      if (iv.t !== "ENTIER" && !(iv.t === "REEL" && Number.isInteger(iv.v))) {
        fail(e.line, `L'indice de ${e.name} doit être un entier, pas ${formatValue(iv)}.`);
      }
      idx.push(iv.v as number);
    }
    let at = 0;
    for (let d = 0; d < arr.dims.length; d++) {
      const { lo, hi } = arr.dims[d]!;
      const i = idx[d]!;
      if (i < lo || i > hi) {
        fail(
          e.line,
          `Indice hors bornes : ${e.name}[${idx.join(", ")}] n'existe pas. ${e.name} est déclaré de ${arr.dims.map((x) => `${x.lo} à ${x.hi}`).join(" × ")}.`,
          "Vérifiez les bornes de votre boucle.",
        );
      }
      at = at * (hi - lo + 1) + (i - lo);
    }
    return { arr, at, label: `${e.name}[${idx.join(", ")}]` };
  }

  // ── affectation ─────────────────────────────────────────────────────────
  private *assign(
    target: LValue,
    value: Value,
    line: number,
  ): Generator<MachineRequest, void, string | undefined> {
    if (target.kind === "var") {
      const fr = this.frame;
      if (
        fr.routine?.kind === "function" &&
        target.key === fr.routine.key &&
        !fr.locals.has(target.key)
      ) {
        fr.result = this.coerce(
          value,
          { kind: "scalar", name: fr.routine.returnType! },
          line,
          `Le résultat de ${fr.routine.name}`,
        );
        return;
      }
      const cell = this.cellOf(target.name, target.key, line);
      if (cell.isConst) {
        fail(
          line,
          `${cell.name} est une constante : sa valeur ne peut pas être modifiée.`,
          "Pour changer sa valeur, modifiez la ligne de sa déclaration dans CONSTANTES.",
        );
      }
      if (cell.type.kind === "array" && value.t === "TABLEAU") {
        cell.set(cloneValue(value));
        return;
      }
      cell.set(
        this.coerce(
          value,
          cell.type.kind === "any" ? { kind: "any" } : cell.type,
          line,
          target.name,
        ),
      );
      return;
    }
    const { arr, at, label } = yield* this.arrayIndex(target);
    arr.data[at] = this.coerce(value, { kind: "scalar", name: arr.elem }, line, label);
  }

  // ── expressions ─────────────────────────────────────────────────────────
  *evalExpr(e: Expr): Generator<MachineRequest, Value, string | undefined> {
    switch (e.kind) {
      case "num":
        return e.isReal ? real(e.value) : int(e.value);
      case "str":
        return e.isChar ? { t: "CARACTERE", v: e.value } : str(e.value);
      case "bool":
        return bool(e.value);
      case "var": {
        if (
          this.frame.routine?.kind === "function" &&
          e.key === this.frame.routine.key &&
          !this.lookup(e.key)
        ) {
          if (this.frame.result) return this.frame.result;
          fail(e.line, `${e.name} n'a pas encore reçu de valeur dans la fonction.`);
        }
        const cell = this.cellOf(e.name, e.key, e.line);
        const v = cell.get();
        if (v === undefined) {
          fail(
            e.line,
            `La variable « ${cell.name} » est utilisée avant d'avoir reçu une valeur.`,
            `Donnez-lui une valeur de départ avant de l'utiliser (par exemple ${cell.name} <- 0).`,
          );
        }
        return v;
      }
      case "index": {
        const { arr, at, label } = yield* this.arrayIndex(e);
        const v = arr.data[at];
        if (v === undefined) {
          fail(
            e.line,
            `La case ${label} est lue avant d'avoir reçu une valeur.`,
            "Remplissez le tableau avant de le lire.",
          );
        }
        return v;
      }
      case "unary": {
        const v = yield* this.evalExpr(e.expr);
        if (e.op === "-") {
          if (!isNumber(v))
            fail(e.line, `Le signe - s'applique à un nombre, pas à ${typeLabel(v.t)}.`);
          return { t: v.t, v: -v.v };
        }
        if (v.t !== "BOOLEEN")
          fail(e.line, `NON s'applique à une condition (VRAI/FAUX), pas à ${typeLabel(v.t)}.`);
        return bool(!v.v);
      }
      case "binary":
        return yield* this.evalBinary(e);
      case "call":
        return yield* this.evalCall(e);
    }
  }

  private *evalBinary(
    e: Extract<Expr, { kind: "binary" }>,
  ): Generator<MachineRequest, Value, string | undefined> {
    const op = e.op;
    if (op === "ET" || op === "OU") {
      const l = yield* this.evalExpr(e.left);
      if (l.t !== "BOOLEEN") this.logicError(e, "gauche", l);
      // Évaluation paresseuse : la droite n'est calculée que si nécessaire.
      if (op === "ET" && !l.v) return bool(false);
      if (op === "OU" && l.v) return bool(true);
      const r = yield* this.evalExpr(e.right);
      if (r.t !== "BOOLEEN") this.logicError(e, "droite", r);
      return r;
    }
    const l = yield* this.evalExpr(e.left);
    const r = yield* this.evalExpr(e.right);
    switch (op) {
      case "+":
        if (isText(l) && isText(r)) return str(l.v + r.v);
        if (isNumber(l) && isNumber(r))
          return { t: l.t === "ENTIER" && r.t === "ENTIER" ? "ENTIER" : "REEL", v: l.v + r.v };
        if (isText(l) || isText(r)) {
          fail(
            e.line,
            "On ne peut pas additionner du texte et un nombre : + ne veut pas dire la même chose dans les deux cas.",
            "Convertissez le nombre avec CHAINE(…), ou séparez les morceaux par des virgules dans ECRIRE.",
          );
        }
        return this.arithError(e, l, r);
      case "-":
      case "*":
        if (isNumber(l) && isNumber(r)) {
          const v = op === "-" ? l.v - r.v : l.v * r.v;
          return { t: l.t === "ENTIER" && r.t === "ENTIER" ? "ENTIER" : "REEL", v };
        }
        return this.arithError(e, l, r);
      case "/":
        if (isNumber(l) && isNumber(r)) {
          if (r.v === 0)
            fail(
              e.line,
              "Division par zéro.",
              "Vérifiez que le diviseur ne vaut pas 0 avant de diviser.",
            );
          return real(l.v / r.v);
        }
        return this.arithError(e, l, r);
      case "DIV":
      case "MOD": {
        if (!isNumber(l) || !isNumber(r)) return this.arithError(e, l, r);
        if (!Number.isInteger(l.v) || !Number.isInteger(r.v)) {
          fail(
            e.line,
            `${op} s'utilise avec des entiers (ici ${formatValue(l)} ${op} ${formatValue(r)}).`,
          );
        }
        if (r.v === 0) fail(e.line, `${op} par zéro.`);
        const q = Math.floor(l.v / r.v);
        return int(op === "DIV" ? q : l.v - q * r.v);
      }
      case "^": {
        if (!isNumber(l) || !isNumber(r)) return this.arithError(e, l, r);
        const v = Math.pow(l.v, r.v);
        if (Number.isNaN(v))
          fail(e.line, `Puissance impossible : ${formatValue(l)} ^ ${formatValue(r)}.`);
        return l.t === "ENTIER" && r.t === "ENTIER" && r.v >= 0 ? int(v) : real(v);
      }
      default:
        return this.compare(e, l, r);
    }
  }

  private logicError(e: Extract<Expr, { kind: "binary" }>, side: string, v: Value): never {
    const other = side === "gauche" ? e.left : e.right;
    fail(
      e.line,
      `${e.op} relie deux conditions, mais à ${side} il y a ${typeLabel(v.t)} (« ${exprToString(other)} »).`,
      `Chaque côté doit être une condition complète : écrivez par exemple « x = 1 ${e.op} x = 2 », et non « x = 1 ${e.op} 2 ».`,
    );
  }

  private arithError(e: Extract<Expr, { kind: "binary" }>, l: Value, r: Value): never {
    fail(
      e.line,
      `L'opération ${e.op} demande des nombres : ici ${typeLabel(l.t)} et ${typeLabel(r.t)}.`,
    );
  }

  private compare(e: Extract<Expr, { kind: "binary" }>, l: Value, r: Value): Value {
    let cmp: number;
    if (isNumber(l) && isNumber(r)) cmp = l.v - r.v;
    else if (isText(l) && isText(r)) cmp = l.v < r.v ? -1 : l.v > r.v ? 1 : 0;
    else if (l.t === "BOOLEEN" && r.t === "BOOLEEN") {
      if (e.op !== "=" && e.op !== "<>")
        fail(e.line, `On ne compare pas des booléens avec ${e.op} : seulement = ou <>.`);
      cmp = l.v === r.v ? 0 : 1;
    } else {
      fail(
        e.line,
        `On ne peut pas comparer ${typeLabel(l.t)} et ${typeLabel(r.t)} (« ${exprToString(e)} »).`,
      );
    }
    switch (e.op) {
      case "=":
        return bool(cmp === 0);
      case "<>":
        return bool(cmp !== 0);
      case "<":
        return bool(cmp < 0);
      case ">":
        return bool(cmp > 0);
      case "<=":
        return bool(cmp <= 0);
      default:
        return bool(cmp >= 0);
    }
  }

  // ── appels ──────────────────────────────────────────────────────────────
  private *evalCall(
    e: Extract<Expr, { kind: "call" }>,
  ): Generator<MachineRequest, Value, string | undefined> {
    const routine = this.program.routines.get(e.key);
    if (routine) {
      if (routine.kind === "procedure") {
        fail(
          e.line,
          `${routine.name} est une PROCEDURE : elle ne renvoie pas de valeur, on ne peut pas l'utiliser dans un calcul.`,
          "Utilisez une FONCTION pour calculer une valeur.",
        );
      }
      const v = yield* this.callRoutine(routine, e.args, e.line);
      return v!;
    }
    const args: Value[] = [];
    for (const a of e.args) args.push(yield* this.evalExpr(a));
    return this.builtin(e.name, e.key, args, e.line);
  }

  private *callRoutine(
    r: Routine,
    argExprs: Expr[],
    line: number,
  ): Generator<MachineRequest, Value | undefined, string | undefined> {
    if (argExprs.length !== r.params.length) {
      fail(
        line,
        `${r.name} attend ${r.params.length} paramètre${r.params.length > 1 ? "s" : ""}, ${argExprs.length} donné${argExprs.length > 1 ? "s" : ""}.`,
      );
    }
    const locals = new Map<string, Cell>();
    for (let i = 0; i < r.params.length; i++) {
      const p = r.params[i]!;
      const a = argExprs[i]!;
      if (p.byRef) {
        if (a.kind === "var") {
          const cell = this.cellOf(a.name, a.key, line);
          if (cell.isConst)
            fail(
              line,
              `${a.name} est une constante : elle ne peut pas être passée en VAR à ${r.name}.`,
            );
          locals.set(p.key, cell);
        } else if (a.kind === "index") {
          const { arr, at } = yield* this.arrayIndex(a);
          locals.set(p.key, new ElemCell(p.name, { kind: "scalar", name: arr.elem }, arr, at));
        } else {
          fail(
            line,
            `Le paramètre ${p.name} de ${r.name} est en VAR : il faut lui passer une variable, pas une valeur calculée.`,
          );
        }
      } else {
        const v = yield* this.evalExpr(a);
        const typed = this.coerce(
          cloneValue(v),
          p.type,
          line,
          `Le paramètre ${p.name} de ${r.name}`,
        );
        locals.set(
          p.key,
          new VarCell(p.name, p.type.kind === "any" ? { kind: "any" } : p.type, typed),
        );
      }
    }
    const saved = this.frame;
    this.depth++;
    if (this.depth > this.limits.maxDepth) {
      throw new AlgoError(
        "limit",
        line,
        `Trop d'appels imbriqués de ${r.name} : la récursivité ne s'arrête pas.`,
        "Vérifiez le cas d'arrêt, et que chaque appel s'en rapproche.",
      );
    }
    this.frame = { routine: r, locals };
    try {
      this.declare(r.vars, r.consts, locals);
      yield* this.step(line);
      yield* this.execBlock(r.body);
      if (r.kind === "function") {
        if (this.frame.result) return this.frame.result;
        fail(
          line,
          `La fonction ${r.name} s'est terminée sans renvoyer de valeur.`,
          "Ajoutez RETOURNER valeur avant le FIN de la fonction.",
        );
      }
      return undefined;
    } catch (signal) {
      if (signal instanceof ReturnSignal) {
        if (r.kind === "procedure") return undefined;
        if (signal.value === undefined)
          fail(line, `La fonction ${r.name} doit RETOURNER une valeur.`);
        return this.coerce(
          signal.value,
          { kind: "scalar", name: r.returnType! },
          line,
          `Le résultat de ${r.name}`,
        );
      }
      throw signal;
    } finally {
      this.frame = saved;
      this.depth--;
    }
  }

  private builtin(name: string, key: string, args: Value[], line: number): Value {
    const upper = key.toUpperCase();
    const arity = (n: number) => {
      if (args.length !== n)
        fail(
          line,
          `${upper} attend ${n} paramètre${n > 1 ? "s" : ""}, ${args.length} donné${args.length > 1 ? "s" : ""}.`,
        );
    };
    const num = (i: number): number => {
      const v = args[i]!;
      if (!isNumber(v)) fail(line, `${upper} attend un nombre, pas ${typeLabel(v.t)}.`);
      return v.v;
    };
    const text = (i: number): string => {
      const v = args[i]!;
      if (!isText(v)) fail(line, `${upper} attend un texte, pas ${typeLabel(v.t)}.`);
      return v.v;
    };
    const integer = (i: number): number => {
      const n = num(i);
      if (!Number.isInteger(n)) fail(line, `${upper} attend un entier, pas ${formatReal(n)}.`);
      return n;
    };
    switch (upper) {
      case "RACINE": {
        arity(1);
        const n = num(0);
        if (n < 0) fail(line, `RACINE d'un nombre négatif (${formatReal(n)}) impossible.`);
        return real(Math.sqrt(n));
      }
      case "ABS": {
        arity(1);
        const v = args[0]!;
        if (!isNumber(v)) fail(line, "ABS attend un nombre.");
        return { t: v.t, v: Math.abs(v.v) };
      }
      case "ENT":
        arity(1);
        return int(Math.floor(num(0)));
      case "ARRONDI": {
        arity(1);
        const n = num(0);
        return int(Math.sign(n) * Math.floor(Math.abs(n) + 0.5));
      }
      case "ALEA": {
        arity(2);
        const a = integer(0);
        const b = integer(1);
        if (b < a)
          fail(
            line,
            `ALEA(${a}, ${b}) : la deuxième borne doit être supérieure ou égale à la première.`,
          );
        return int(a + Math.floor(this.random() * (b - a + 1)));
      }
      case "LONGUEUR":
        arity(1);
        return int([...text(0)].length);
      case "MAJUSCULE":
        arity(1);
        return str(text(0).toUpperCase());
      case "MINUSCULE":
        arity(1);
        return str(text(0).toLowerCase());
      case "SOUSCHAINE": {
        arity(3);
        const s = [...text(0)];
        const start = integer(1);
        const n = integer(2);
        if (start < 1) fail(line, "SOUSCHAINE : la position de départ commence à 1.");
        if (n < 0) fail(line, "SOUSCHAINE : le nombre de caractères ne peut pas être négatif.");
        return str(s.slice(start - 1, start - 1 + n).join(""));
      }
      case "CAR": {
        arity(2);
        const s = [...text(0)];
        const i = integer(1);
        if (i < 1 || i > s.length) {
          fail(
            line,
            `CAR : la position ${i} n'existe pas dans un texte de ${s.length} caractère${s.length > 1 ? "s" : ""}.`,
            "La première lettre est à la position 1.",
          );
        }
        return { t: "CARACTERE", v: s[i - 1]! };
      }
      case "ENTIER": {
        arity(1);
        const v = args[0]!;
        if (isNumber(v)) return int(Math.trunc(v.v));
        if (isText(v) && /^\s*[+-]?\d+\s*$/.test(v.v)) return int(Number(v.v));
        fail(line, `ENTIER : « ${formatValue(v)} » ne peut pas être converti en entier.`);
      }

      case "REEL": {
        arity(1);
        const v = args[0]!;
        if (isNumber(v)) return real(v.v);
        if (isText(v) && /^\s*[+-]?(\d+([.,]\d*)?|[.,]\d+)\s*$/.test(v.v))
          return real(Number(v.v.replace(",", ".")));
        fail(line, `REEL : « ${formatValue(v)} » ne peut pas être converti en réel.`);
      }

      case "CHAINE":
        arity(1);
        return str(formatValue(args[0]));
      case "ASCII": {
        arity(1);
        const s = text(0);
        if ([...s].length !== 1) fail(line, "ASCII attend un seul caractère.");
        return int(s.codePointAt(0)!);
      }
      case "CARACTERE": {
        arity(1);
        const n = integer(0);
        if (n < 0 || n > 0x10ffff) fail(line, `CARACTERE(${n}) : code invalide.`);
        return { t: "CARACTERE", v: String.fromCodePoint(n) };
      }
      default:
        fail(
          line,
          `« ${name} » n'est ni une fonction connue ni un sous-programme défini.`,
          "Vérifiez l'orthographe, ou définissez la FONCTION avant DEBUT.",
        );
    }
  }

  // ── instructions ────────────────────────────────────────────────────────
  private *execBlock(stmts: Stmt[]): Generator<MachineRequest, void, string | undefined> {
    for (const s of stmts) yield* this.exec(s);
  }

  private loopInfo(s: Extract<Stmt, { kind: "while" | "repeat" }>): LoopInfo {
    let info = this.loopCache.get(s);
    if (!info) {
      const condVars = new Set<string>();
      const calls = { user: false };
      collectExprVars(s.cond, condVars, calls, this.program.routines);
      const modified = new Set<string>();
      const flags = { user: calls.user, ret: false };
      collectModified(s.body, modified, flags, this.program.routines);
      info = { condVars, modified, hasUserCall: flags.user, hasReturn: flags.ret };
      this.loopCache.set(s, info);
    }
    return info;
  }

  /** La condition ne peut pas changer : aucune de ses variables n'est modifiée. */
  private frozenCondition(s: Extract<Stmt, { kind: "while" | "repeat" }>): boolean {
    const info = this.loopInfo(s);
    if (info.hasUserCall || info.hasReturn) return false;
    for (const v of info.condVars) {
      if (info.modified.has(v)) return false;
      // Une constante dans la condition ne compte pas.
    }
    return true;
  }

  private infiniteLoop(s: Extract<Stmt, { kind: "while" | "repeat" }>): never {
    const info = this.loopInfo(s);
    const vars = [...info.condVars]
      .map((k) => this.lookup(k))
      .filter((c): c is Cell => !!c && !c.isConst)
      .map((c) => c.name);
    const cond = exprToString(s.cond);
    const closer = s.kind === "while" ? "FINTANTQUE" : "JUSQU'A";
    let hint = `Modifiez une variable de la condition dans la boucle, avant ${closer}.`;
    if (s.cond.kind === "binary" && s.cond.left.kind === "var" && vars.length === 1) {
      const up = ["<", "<="].includes(s.cond.op) === (s.kind === "while");
      hint = `Ajoutez par exemple « ${vars[0]} <- ${vars[0]} ${up ? "+" : "-"} 1 » dans la boucle, avant ${closer}.`;
    }
    fail(
      s.line,
      vars.length
        ? `Boucle infinie : la condition « ${cond} » ne change jamais, car ${vars.length > 1 ? `ni ${vars.join(" ni ")} ne sont modifiés` : `${vars[0]} n'est jamais modifié`} dans la boucle.`
        : `Boucle infinie : la condition « ${cond} » ne change jamais.`,
      hint,
    );
  }

  /**
   * Boucle qui s'éloigne de son arrêt : « TANT QUE i <= 5 » alors que i diminue.
   * Renvoie un suivi à mettre à jour à chaque tour.
   */
  private divergenceTracker(s: Extract<Stmt, { kind: "while" }>) {
    const c = s.cond;
    if (c.kind !== "binary" || !["<", "<=", ">", ">="].includes(c.op)) return null;
    let variable: Extract<Expr, { kind: "var" }> | null = null;
    let mustGrow: boolean;
    let bound: Expr;
    if (c.left.kind === "var") {
      variable = c.left;
      mustGrow = c.op === "<" || c.op === "<=";
      bound = c.right;
    } else if (c.right.kind === "var") {
      variable = c.right;
      mustGrow = c.op === ">" || c.op === ">=";
      bound = c.left;
    } else return null;
    const info = this.loopInfo(s);
    const boundVars = new Set<string>();
    collectExprVars(bound, boundVars, { user: false }, this.program.routines);
    for (const b of boundVars) if (info.modified.has(b)) return null;
    if (info.hasUserCall || info.hasReturn) return null;
    const v = variable;
    const history: number[] = [];
    let wrong = 0;
    return (): void => {
      const cell = this.lookup(v.key);
      const val = cell?.get();
      if (!val || !isNumber(val)) return;
      const prev = history[history.length - 1];
      history.push(val.v);
      if (prev === undefined) return;
      const moved = val.v - prev;
      if ((mustGrow && moved < 0) || (!mustGrow && moved > 0)) wrong++;
      else wrong = 0;
      if (wrong >= 5) {
        fail(
          s.line,
          `Boucle infinie : la condition « ${exprToString(c)} » demande que ${v.name} ${mustGrow ? "augmente" : "diminue"}, mais ${v.name} ${mustGrow ? "diminue" : "augmente"} à chaque tour (${history
            .slice(-6)
            .map((x) => formatReal(x))
            .join(", ")}…).`,
          `${v.name} doit évoluer dans le bon sens pour que la boucle s'arrête.`,
        );
      }
    };
  }

  /** Variables visibles dans le contexte courant, pour l'affichage en cases. */
  snapshot(): { name: string; type: string; value: string; items?: string[] }[] {
    const out: { name: string; type: string; value: string; items?: string[] }[] = [];
    for (const cell of this.frame.locals.values()) {
      if (cell.isConst) continue;
      const v = cell.get();
      out.push({
        name: cell.name,
        type: typeName(cell.type),
        value: v === undefined ? "?" : v.t === "CHAINE" ? `"${v.v}"` : formatValue(v),
        items: v?.t === "TABLEAU" ? v.v.data.map((x) => formatValue(x)) : undefined,
      });
    }
    return out;
  }

  private *exec(s: Stmt): Generator<MachineRequest, void, string | undefined> {
    this.onStmt?.(s);
    yield* this.step(s.line);
    switch (s.kind) {
      case "assign": {
        const v = yield* this.evalExpr(s.value);
        yield* this.assign(s.target, v, s.line);
        return;
      }
      case "write": {
        for (const a of s.args) {
          const v = yield* this.evalExpr(a);
          if (v.t === "TABLEAU")
            fail(
              s.line,
              "On n'affiche pas un tableau d'un coup : affichez ses cases une par une, avec une boucle.",
            );
          this.emit(formatValue(v));
        }
        if (s.newline) this.emit("\n");
        return;
      }
      case "newline":
        this.emit("\n");
        return;
      case "read": {
        for (const t of s.targets) {
          let type: TypeSpec;
          let label: string;
          if (t.kind === "var") {
            const cell = this.cellOf(t.name, t.key, s.line);
            if (cell.isConst)
              fail(s.line, `${cell.name} est une constante : on ne peut pas y LIRE une valeur.`);
            if (cell.type.kind === "array")
              fail(
                s.line,
                `${t.name} est un tableau : lisez ses cases une par une, LIRE(${t.name}[i]).`,
              );
            type = cell.type;
            label = cell.name;
          } else {
            const { arr, label: l } = yield* this.arrayIndex(t);
            type = { kind: "scalar", name: arr.elem };
            label = l;
          }
          const raw = yield {
            type: "input",
            varName: label,
            varType: typeName(type),
            line: s.line,
          };
          if (raw === undefined) {
            throw new AlgoError(
              "input",
              s.line,
              `Le programme attend une valeur pour ${label} (LIRE), mais aucune n'a été saisie.`,
            );
          }
          this.emit(`${raw}\n`, "in");
          yield* this.assign(t, this.parseInput(raw, type, label, s.line), s.line);
        }
        return;
      }
      case "if": {
        const c = yield* this.evalExpr(s.cond);
        if (c.t !== "BOOLEEN")
          fail(s.line, `La condition du SI doit valoir VRAI ou FAUX, pas ${typeLabel(c.t)}.`);
        if (c.v) yield* this.execBlock(s.then);
        else if (s.else) yield* this.execBlock(s.else);
        return;
      }
      case "for": {
        const cell = this.cellOf(s.var.name, s.var.key, s.line);
        if (cell.isConst)
          fail(s.line, `${cell.name} est une constante : elle ne peut pas servir de compteur.`);
        const from = yield* this.evalExpr(s.from);
        const to = yield* this.evalExpr(s.to);
        const step = s.step ? yield* this.evalExpr(s.step) : int(1);
        for (const [what, v] of [
          ["départ", from],
          ["arrivée", to],
          ["PAS", step],
        ] as const) {
          if (!isNumber(v)) fail(s.line, `POUR : la valeur de ${what} doit être un nombre.`);
        }
        const a = from.v as number;
        const b = to.v as number;
        const p = step.v as number;
        if (p === 0) fail(s.line, "POUR : un PAS de 0 ferait tourner la boucle à l'infini.");
        for (let i = a; p > 0 ? i <= b : i >= b; i += p) {
          yield* this.assign(s.var, int(i), s.line);
          yield* this.step(s.line);
          yield* this.execBlock(s.body);
        }
        return;
      }
      case "while": {
        const track = this.divergenceTracker(s);
        let first = true;
        for (;;) {
          const c = yield* this.evalExpr(s.cond);
          if (c.t !== "BOOLEEN")
            fail(
              s.line,
              `La condition du TANT QUE doit valoir VRAI ou FAUX, pas ${typeLabel(c.t)}.`,
            );
          if (!c.v) return;
          if (first && this.frozenCondition(s)) this.infiniteLoop(s);
          first = false;
          track?.();
          yield* this.step(s.line);
          yield* this.execBlock(s.body);
        }
      }
      case "repeat": {
        for (;;) {
          yield* this.step(s.line);
          yield* this.execBlock(s.body);
          const c = yield* this.evalExpr(s.cond);
          if (c.t !== "BOOLEEN")
            fail(
              s.line,
              `La condition du JUSQU'A doit valoir VRAI ou FAUX, pas ${typeLabel(c.t)}.`,
            );
          if (c.v) return;
          if (this.frozenCondition(s)) this.infiniteLoop(s);
        }
      }
      case "call": {
        const routine = this.program.routines.get(s.key);
        if (!routine) {
          if (this.lookup(s.key)) {
            fail(
              s.line,
              `${s.name} est une variable : pour lui donner une valeur, écrivez ${s.name} <- valeur.`,
            );
          }
          // Fonction prédéfinie appelée seule : on l'évalue (et on ignore son résultat).
          const args: Value[] = [];
          for (const a of s.args) args.push(yield* this.evalExpr(a));
          this.builtin(s.name, s.key, args, s.line);
          return;
        }
        yield* this.callRoutine(routine, s.args, s.line);
        return;
      }
      case "return": {
        if (!this.frame.routine)
          fail(s.line, "RETOURNER s'utilise dans une FONCTION, pas dans l'algorithme principal.");
        const v = s.value ? yield* this.evalExpr(s.value) : undefined;
        throw new ReturnSignal(v);
      }
    }
  }

  /** Exécution complète du programme. */
  *run(): Generator<MachineRequest, void, string | undefined> {
    this.declare(this.program.vars, this.program.consts, this.globals);
    yield* this.execBlock(this.program.body);
  }
}

export type { ScalarType };
