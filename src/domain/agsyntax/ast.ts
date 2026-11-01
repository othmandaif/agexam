/** Arbre syntaxique du pseudo-code AGSyntax. */
export type ScalarType = "ENTIER" | "REEL" | "CHAINE" | "CARACTERE" | "BOOLEEN";

export interface ArrayType {
  kind: "array";
  /** Bornes de chaque dimension (expressions évaluées à la déclaration). */
  dims: { lo: Expr; hi: Expr }[] | null;
  elem: ScalarType;
}

export type TypeSpec = { kind: "scalar"; name: ScalarType } | ArrayType | { kind: "any" };

export interface VarDecl {
  name: string;
  key: string;
  type: TypeSpec;
  line: number;
}

export interface ConstDecl {
  name: string;
  key: string;
  value: Expr;
  type: ScalarType | null;
  line: number;
}

export interface Param {
  name: string;
  key: string;
  byRef: boolean;
  type: TypeSpec;
  line: number;
}

export interface Routine {
  kind: "procedure" | "function";
  name: string;
  key: string;
  params: Param[];
  returnType: ScalarType | null;
  consts: ConstDecl[];
  vars: VarDecl[];
  body: Stmt[];
  line: number;
}

export interface Program {
  name: string | null;
  consts: ConstDecl[];
  vars: VarDecl[];
  routines: Map<string, Routine>;
  body: Stmt[];
  line: number;
}

export type Expr =
  | { kind: "num"; value: number; isReal: boolean; line: number }
  | { kind: "str"; value: string; isChar: boolean; line: number }
  | { kind: "bool"; value: boolean; line: number }
  | { kind: "var"; name: string; key: string; line: number }
  | { kind: "index"; name: string; key: string; indices: Expr[]; line: number }
  | { kind: "call"; name: string; key: string; args: Expr[]; line: number }
  | { kind: "unary"; op: "-" | "NON"; expr: Expr; line: number }
  | { kind: "binary"; op: string; left: Expr; right: Expr; line: number };

export type LValue = Extract<Expr, { kind: "var" } | { kind: "index" }>;

export type Stmt =
  | { kind: "assign"; target: LValue; value: Expr; line: number }
  | { kind: "write"; args: Expr[]; newline: boolean; line: number }
  | { kind: "newline"; line: number }
  | { kind: "read"; targets: LValue[]; line: number }
  | { kind: "if"; cond: Expr; then: Stmt[]; else: Stmt[] | null; line: number }
  | {
      kind: "for";
      var: LValue & { kind: "var" };
      from: Expr;
      to: Expr;
      step: Expr | null;
      body: Stmt[];
      line: number;
    }
  | { kind: "while"; cond: Expr; body: Stmt[]; line: number; endLine: number }
  | { kind: "repeat"; body: Stmt[]; cond: Expr; line: number }
  | { kind: "call"; name: string; key: string; args: Expr[]; line: number }
  | { kind: "return"; value: Expr | null; line: number };
