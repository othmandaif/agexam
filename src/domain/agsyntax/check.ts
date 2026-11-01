import type { Expr, Program, Routine, Stmt } from "./ast";
import { AlgoError } from "./errors";

const BUILTINS: Record<string, number> = {
  racine: 1,
  abs: 1,
  ent: 1,
  arrondi: 1,
  alea: 2,
  longueur: 1,
  majuscule: 1,
  minuscule: 1,
  souschaine: 3,
  car: 2,
  entier: 1,
  reel: 1,
  chaine: 1,
  ascii: 1,
  caractere: 1,
};

interface Scope {
  vars: Map<string, { name: string; isConst: boolean; isArray: boolean }>;
  routine: Routine | null;
}

/**
 * Vérification avant exécution (comme « Vérifier » dans AGSyntax) : variables
 * non déclarées, constante modifiée, sous-programme inconnu ou mal appelé.
 * Détecte les erreurs même dans une branche qui ne s'exécuterait pas.
 */
export function checkProgram(p: Program): void {
  const globals: Scope["vars"] = new Map();
  for (const c of p.consts) globals.set(c.key, { name: c.name, isConst: true, isArray: false });
  for (const v of p.vars)
    globals.set(v.key, { name: v.name, isConst: false, isArray: v.type.kind === "array" });

  function fail(line: number, message: string, hint?: string): never {
    throw new AlgoError("syntax", line, message, hint);
  }

  const resolve = (scope: Scope, key: string) => scope.vars.get(key) ?? globals.get(key);

  const checkExpr = (scope: Scope, e: Expr): void => {
    switch (e.kind) {
      case "var": {
        if (resolve(scope, e.key)) return;
        if (scope.routine?.kind === "function" && scope.routine.key === e.key) return;
        if (p.routines.has(e.key)) {
          const r = p.routines.get(e.key)!;
          if (r.params.length === 0 && r.kind === "function") {
            fail(e.line, `Appel de la fonction ${r.name} : ajoutez des parenthèses, ${r.name}().`);
          }
          fail(e.line, `${r.name} est un sous-programme, pas une variable.`);
        }
        fail(
          e.line,
          `La variable « ${e.name} » n'est pas déclarée.`,
          "Déclarez-la dans VARIABLES, avant DEBUT.",
        );
        return;
      }
      case "index": {
        const v = resolve(scope, e.key);
        if (!v) fail(e.line, `Le tableau « ${e.name} » n'est pas déclaré.`);
        e.indices.forEach((i) => checkExpr(scope, i));
        return;
      }
      case "call": {
        const r = p.routines.get(e.key);
        if (r) {
          if (r.kind === "procedure") {
            fail(
              e.line,
              `${r.name} est une PROCEDURE : elle ne renvoie pas de valeur, on ne peut pas l'utiliser dans un calcul.`,
            );
          }
          arity(r, e.args.length, e.line);
        } else if (e.key in BUILTINS) {
          const n = BUILTINS[e.key]!;
          if (e.args.length !== n) {
            fail(
              e.line,
              `${e.name.toUpperCase()} attend ${n} paramètre${n > 1 ? "s" : ""}, ${e.args.length} donné${e.args.length > 1 ? "s" : ""}.`,
            );
          }
        } else if (resolve(scope, e.key)) {
          fail(
            e.line,
            `${e.name} est une variable, pas une fonction : pour un tableau, utilisez des crochets ${e.name}[i].`,
          );
        } else {
          fail(
            e.line,
            `« ${e.name} » n'est ni une fonction connue ni un sous-programme défini.`,
            "Vérifiez l'orthographe.",
          );
        }
        e.args.forEach((a) => checkExpr(scope, a));
        return;
      }
      case "unary":
        checkExpr(scope, e.expr);
        return;
      case "binary":
        if (e.op === "ET" || e.op === "OU") {
          for (const side of [e.left, e.right]) {
            const notCondition =
              side.kind === "num" ||
              side.kind === "str" ||
              (side.kind === "binary" && ["+", "-", "*", "/", "DIV", "MOD", "^"].includes(side.op));
            if (notCondition) {
              fail(
                e.line,
                `${e.op} relie deux conditions complètes : « ${side.kind === "str" ? `"${side.value}"` : side.kind === "num" ? side.value : "un calcul"} » n'est pas une condition.`,
                `Écrivez par exemple « x = 1 ${e.op} x = 2 », et non « x = 1 ${e.op} 2 ».`,
              );
            }
          }
        }
        checkExpr(scope, e.left);
        checkExpr(scope, e.right);
        return;
      default:
        return;
    }
  };

  const arity = (r: Routine, n: number, line: number) => {
    if (n !== r.params.length) {
      fail(
        line,
        `${r.name} attend ${r.params.length} paramètre${r.params.length > 1 ? "s" : ""}, ${n} donné${n > 1 ? "s" : ""}.`,
      );
    }
  };

  const checkTarget = (
    scope: Scope,
    t: Extract<Expr, { kind: "var" | "index" }>,
    line: number,
    verb: string,
  ) => {
    if (
      t.kind === "var" &&
      scope.routine?.kind === "function" &&
      scope.routine.key === t.key &&
      !scope.vars.has(t.key)
    )
      return;
    const v = resolve(scope, t.key);
    if (!v)
      fail(
        line,
        `La variable « ${t.name} » n'est pas déclarée.`,
        "Déclarez-la dans VARIABLES, avant DEBUT.",
      );
    if (v.isConst) {
      fail(
        line,
        `${v.name} est une constante : ${verb}.`,
        "Une constante garde la valeur fixée dans CONSTANTES. Pour la changer, modifiez sa déclaration.",
      );
    }
    if (t.kind === "index") t.indices.forEach((i) => checkExpr(scope, i));
  };

  const checkBlock = (scope: Scope, stmts: Stmt[]): void => {
    for (const s of stmts) {
      switch (s.kind) {
        case "assign":
          checkTarget(scope, s.target, s.line, "sa valeur ne peut pas être modifiée");
          checkExpr(scope, s.value);
          break;
        case "read":
          s.targets.forEach((t) =>
            checkTarget(scope, t, s.line, "on ne peut pas y LIRE une valeur"),
          );
          break;
        case "write":
          s.args.forEach((a) => checkExpr(scope, a));
          break;
        case "if":
          checkExpr(scope, s.cond);
          checkBlock(scope, s.then);
          if (s.else) checkBlock(scope, s.else);
          break;
        case "for":
          checkTarget(scope, s.var, s.line, "elle ne peut pas servir de compteur");
          checkExpr(scope, s.from);
          checkExpr(scope, s.to);
          if (s.step) checkExpr(scope, s.step);
          checkBlock(scope, s.body);
          break;
        case "while":
        case "repeat":
          checkExpr(scope, s.cond);
          checkBlock(scope, s.body);
          break;
        case "call": {
          const r = p.routines.get(s.key);
          if (r) arity(r, s.args.length, s.line);
          else if (s.key in BUILTINS) {
            fail(
              s.line,
              `${s.name.toUpperCase()} calcule une valeur : utilisez-la dans une expression (x <- ${s.name.toUpperCase()}(…) ou ECRIRE(…)).`,
            );
          } else if (resolve(scope, s.key)) {
            fail(
              s.line,
              `« ${s.name} » seul ne fait rien : pour lui donner une valeur, écrivez ${s.name} <- valeur.`,
            );
          } else {
            fail(
              s.line,
              `« ${s.name} » n'est ni une instruction connue ni une PROCEDURE définie.`,
              "Vérifiez l'orthographe (ECRIRE, LIRE, SI, POUR…).",
            );
          }
          s.args.forEach((a) => checkExpr(scope, a));
          if (r) {
            r.params.forEach((param, i) => {
              const a = s.args[i];
              if (param.byRef && a && a.kind !== "var" && a.kind !== "index") {
                fail(
                  s.line,
                  `Le paramètre ${param.name} de ${r.name} est en VAR : passez-lui une variable, pas une valeur calculée.`,
                );
              }
            });
          }
          break;
        }
        case "return":
          if (!scope.routine)
            fail(s.line, "RETOURNER s'utilise dans une FONCTION, pas dans l'algorithme principal.");
          if (s.value) checkExpr(scope, s.value);
          break;
        default:
          break;
      }
    }
  };

  for (const r of p.routines.values()) {
    const vars: Scope["vars"] = new Map();
    for (const prm of r.params)
      vars.set(prm.key, { name: prm.name, isConst: false, isArray: prm.type.kind === "array" });
    for (const c of r.consts) vars.set(c.key, { name: c.name, isConst: true, isArray: false });
    for (const v of r.vars)
      vars.set(v.key, { name: v.name, isConst: false, isArray: v.type.kind === "array" });
    checkBlock({ vars, routine: r }, r.body);
  }
  checkBlock({ vars: new Map(), routine: null }, p.body);
}
