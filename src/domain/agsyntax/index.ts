/**
 * Interpréteur du pseudo-code AGSyntax (règles de la dernière version du
 * tutoriel). Partagé entre le navigateur (exécution interactive) et le serveur
 * (tests automatiques, notation) : même moteur, mêmes résultats.
 */
import type { Program } from "./ast";
import { checkProgram } from "./check";
import { AlgoError, errorInfo, type AlgoErrorInfo } from "./errors";
import {
  DEFAULT_LIMITS,
  Machine,
  type MachineLimits,
  type MachineRequest,
  type OutputSegment,
} from "./interpreter";
import { parseProgram } from "./parser";

export type { AlgoErrorInfo, OutputSegment, MachineLimits };
export { AlgoError };

export type CompileResult = { ok: true; program: Program } | { ok: false; error: AlgoErrorInfo };

export function compile(code: string): CompileResult {
  try {
    const program = parseProgram(code);
    checkProgram(program);
    return { ok: true, program };
  } catch (e) {
    if (e instanceof AlgoError) return { ok: false, error: errorInfo(e) };
    throw e;
  }
}

/** Générateur pseudo-aléatoire reproductible (ALEA identique d'un test à l'autre). */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface RunResult {
  /** Transcription complète (sorties + saisies en écho), comme dans une console. */
  output: string;
  segments: OutputSegment[];
  error: AlgoErrorInfo | null;
  steps: number;
  /** Nombre de valeurs consommées par LIRE. */
  inputsUsed: number;
}

export interface RunOptions {
  inputs?: string[];
  limits?: Partial<MachineLimits>;
  seed?: number;
}

/** Exécution complète avec des saisies fournies d'avance (tests, notation). */
export function runAlgorithm(code: string, options: RunOptions = {}): RunResult {
  const compiled = compile(code);
  if (!compiled.ok) {
    return { output: "", segments: [], error: compiled.error, steps: 0, inputsUsed: 0 };
  }
  const machine = new Machine(
    compiled.program,
    { ...DEFAULT_LIMITS, ...options.limits },
    seededRandom(options.seed ?? 20260901),
  );
  const inputs = options.inputs ?? [];
  let used = 0;
  let error: AlgoErrorInfo | null = null;
  const gen = machine.run();
  try {
    let answer: string | undefined;
    for (;;) {
      const r = gen.next(answer);
      if (r.done) break;
      answer = undefined;
      if (r.value.type === "input") {
        answer = used < inputs.length ? inputs[used++] : undefined;
      }
    }
  } catch (e) {
    if (e instanceof AlgoError) error = errorInfo(e);
    else throw e;
  }
  return {
    output: machine.output,
    segments: machine.segments,
    error,
    steps: machine.steps,
    inputsUsed: used,
  };
}

// ── Session interactive (navigateur) ─────────────────────────────────────
export type SessionState =
  | { status: "running" }
  | { status: "input"; varName: string; varType: string; line: number }
  | { status: "done" }
  | { status: "error"; error: AlgoErrorInfo }
  | { status: "stopped" };

/**
 * Exécution pas à pas pilotée par l'interface : `advance` avance jusqu'à une
 * saisie, la fin, ou l'épuisement du budget de temps (pour ne pas figer la page).
 */
export class AlgoSession {
  private gen: Generator<MachineRequest, void, string | undefined> | null = null;
  private machine: Machine | null = null;
  state: SessionState = { status: "running" };

  constructor(code: string, limits: Partial<MachineLimits> = {}) {
    const compiled = compile(code);
    if (!compiled.ok) {
      this.state = { status: "error", error: compiled.error };
      return;
    }
    this.machine = new Machine(compiled.program, {
      ...DEFAULT_LIMITS,
      tickEvery: 5_000,
      ...limits,
    });
    this.gen = this.machine.run();
  }

  get segments(): OutputSegment[] {
    return this.machine?.segments ?? [];
  }

  get steps(): number {
    return this.machine?.steps ?? 0;
  }

  /** Avance l'exécution ; `input` répond à la saisie en attente. */
  advance(input?: string, budgetMs = 30): SessionState {
    if (!this.gen || (this.state.status !== "running" && this.state.status !== "input"))
      return this.state;
    const deadline = Date.now() + budgetMs;
    let answer = input;
    try {
      for (;;) {
        const r = this.gen.next(answer);
        answer = undefined;
        if (r.done) return (this.state = { status: "done" });
        if (r.value.type === "input") {
          const { varName, varType, line } = r.value;
          return (this.state = { status: "input", varName, varType, line });
        }
        if (Date.now() > deadline) return (this.state = { status: "running" });
      }
    } catch (e) {
      if (e instanceof AlgoError) return (this.state = { status: "error", error: errorInfo(e) });
      throw e;
    }
  }

  stop(): void {
    this.gen = null;
    this.state = { status: "stopped" };
  }
}

/** Normalisation pour comparer deux sorties (espaces en fin de ligne, lignes vides finales). */
export function normalizeOutput(text: string): string {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/, ""))
    .join("\n")
    .replace(/\n+$/, "");
}
