/**
 * Trace d'exécution pas à pas : pour chaque instruction, la ligne, l'état des
 * variables (cases), le texte affiché et une courte explication en français.
 * Sert aux indices animés et à la trace rendue avec un devoir.
 */
import type { Stmt } from "./ast";
import { compile, seededRandom } from "./index";
import { AlgoError, errorInfo, type AlgoErrorInfo } from "./errors";
import { DEFAULT_LIMITS, exprToString, Machine } from "./interpreter";

export interface TraceVar {
  name: string;
  type: string;
  value: string;
  /** Contenu d'un tableau. */
  items?: string[];
  /** Valeur modifiée depuis l'image précédente. */
  changed: boolean;
}

export interface TraceFrame {
  line: number;
  explain: string;
  vars: TraceVar[];
  /** Texte affiché jusqu'ici (saisies en écho comprises, comme une console). */
  output: string;
  /** Seulement ce que l'algorithme affiche (sans l'écho des saisies). Absent des anciens rendus. */
  screen?: string;
}

export interface TraceResult {
  frames: TraceFrame[];
  error: AlgoErrorInfo | null;
  /** Trace coupée (boucle très longue) : seules les premières images sont gardées. */
  truncated: boolean;
}

const txt = (e: Parameters<typeof exprToString>[0]) => exprToString(e);

/** Explication courte d'une instruction (avant son exécution). */
export function explainStmt(s: Stmt): string {
  switch (s.kind) {
    case "assign":
      return `On calcule ${txt(s.value)} puis on range le résultat dans ${txt(s.target)}.`;
    case "write":
      return `On affiche ${s.args.map(txt).join(", ")}.`;
    case "newline":
      return "On passe à la ligne suivante de l'affichage.";
    case "read":
      return `On lit une valeur saisie et on la range dans ${s.targets.map(txt).join(", ")}.`;
    case "if":
      return `On teste la condition ${txt(s.cond)} : si elle est vraie, on exécute le bloc ALORS${
        s.else ? ", sinon le bloc SINON" : ""
      }.`;
    case "for":
      return `Boucle POUR : ${txt(s.var)} prend ${txt(s.from)}, puis chaque valeur jusqu'à ${txt(s.to)}.`;
    case "while":
      return `Boucle TANTQUE : on teste ${txt(s.cond)} ; tant qu'elle est vraie, on répète le bloc.`;
    case "repeat":
      return `Boucle REPETER : on exécute le bloc, puis on s'arrête dès que ${txt(s.cond)} est vraie.`;
    case "call":
      return `On appelle ${s.name}(${s.args.map(txt).join(", ")}).`;
    case "return":
      return s.value ? `On renvoie ${txt(s.value)}.` : "On quitte la procédure.";
  }
}

/** Commentaire « // … » d'une ligne (hors chaînes) : explication écrite par le formateur. */
export function lineComment(line: string): string | null {
  let quote: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (quote) {
      if (c === quote) quote = null;
    } else if (c === '"' || c === "'") quote = c;
    else if (c === "/" && line[i + 1] === "/") {
      const text = line.slice(i + 2).trim();
      return text || null;
    }
  }
  return null;
}

/**
 * Exécute l'algorithme avec ces saisies et enregistre une image par instruction.
 * L'explication d'un pas est le commentaire « // … » de la ligne s'il existe,
 * sinon une phrase générée.
 */
export function traceAlgorithm(code: string, inputs: string[], maxFrames = 400): TraceResult {
  const source = code.replace(/\r/g, "").split("\n");
  const compiled = compile(code);
  if (!compiled.ok) return { frames: [], error: compiled.error, truncated: false };
  const machine = new Machine(
    compiled.program,
    { ...DEFAULT_LIMITS, maxSteps: 20_000, maxOutputChars: 20_000 },
    seededRandom(20260901),
  );
  const frames: TraceFrame[] = [];
  let truncated = false;
  let previous = new Map<string, string>();
  const screen = () =>
    machine.segments
      .filter((g) => g.kind === "out")
      .map((g) => g.text)
      .join("");
  /** Test SI en attente : la ligne suivante dit si la condition était vraie. */
  let pendingIf: { index: number; thenLine: number | null } | null = null;
  const settleIf = (nextLine: number | null) => {
    if (!pendingIf) return;
    const yes = pendingIf.thenLine !== null && nextLine === pendingIf.thenLine;
    const f = frames[pendingIf.index]!;
    f.explain = `${f.explain} → ${yes ? "OUI (vrai)" : "NON (faux)"}`;
    pendingIf = null;
  };
  machine.onStmt = (s) => {
    settleIf(s.line);
    if (frames.length >= maxFrames) {
      truncated = true;
      return;
    }
    const vars: TraceVar[] = machine.snapshot().map((v) => {
      const key = v.items ? `[${v.items.join(",")}]` : v.value;
      return { ...v, changed: previous.get(v.name) !== key };
    });
    previous = new Map(vars.map((v) => [v.name, v.items ? `[${v.items.join(",")}]` : v.value]));
    const own = lineComment(source[s.line - 1] ?? "");
    frames.push({
      line: s.line,
      explain: own ?? explainStmt(s),
      vars,
      output: machine.output,
      screen: screen(),
    });
    if (s.kind === "if") {
      pendingIf = { index: frames.length - 1, thenLine: s.then[0]?.line ?? null };
    }
  };
  let error: AlgoErrorInfo | null = null;
  let used = 0;
  const gen = machine.run();
  try {
    let answer: string | undefined;
    for (;;) {
      const r = gen.next(answer);
      if (r.done) break;
      answer = undefined;
      if (r.value.type === "input") answer = used < inputs.length ? inputs[used++] : undefined;
    }
  } catch (e) {
    if (e instanceof AlgoError) error = errorInfo(e);
    else throw e;
  }
  settleIf(null);
  // Image finale : état après la dernière instruction.
  if (!truncated && frames.length < maxFrames) {
    const vars: TraceVar[] = machine.snapshot().map((v) => ({
      ...v,
      changed: previous.get(v.name) !== (v.items ? `[${v.items.join(",")}]` : v.value),
    }));
    frames.push({
      line: frames[frames.length - 1]?.line ?? 1,
      explain: error ? error.message : "Fin de l'algorithme.",
      vars,
      output: machine.output,
      screen: screen(),
    });
  }
  return { frames, error, truncated };
}
