import type {
  ArrayType,
  ConstDecl,
  Expr,
  LValue,
  Param,
  Program,
  Routine,
  ScalarType,
  Stmt,
  TypeSpec,
  VarDecl,
} from "./ast";
import { AlgoError } from "./errors";
import { identKey, tokenize, TYPE_NAMES, type Token } from "./lexer";

/** Mots qui terminent un bloc d'instructions. */
const BLOCK_ENDS = new Set([
  "FIN",
  "FINSI",
  "SINON",
  "SINONSI",
  "FINPOUR",
  "FINTANTQUE",
  "JUSQUA",
  "FINPROCEDURE",
  "FINFONCTION",
  "PROCEDURE",
  "FONCTION",
  "VARIABLES",
  "VARIABLE",
  "CONSTANTES",
  "CONSTANTE",
  "EOF",
]);

const CLOSER_OF: Record<string, string> = {
  SI: "FINSI",
  POUR: "FINPOUR",
  "TANT QUE": "FINTANTQUE",
  REPETER: "JUSQU'A",
};

const COMPARISON = new Set(["=", "<>", "<", ">", "<=", ">="]);

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  // ── utilitaires ─────────────────────────────────────────────────────────
  private peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)]!;
  }
  private next(): Token {
    const t = this.peek();
    if (t.type !== "eof") this.pos++;
    return t;
  }
  private isKw(word: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.type === "kw" && t.value === word;
  }
  private isOp(op: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.type === "op" && t.value === op;
  }
  private acceptOp(op: string): boolean {
    if (this.isOp(op)) {
      this.pos++;
      return true;
    }
    return false;
  }
  private expectOp(op: string, what: string): Token {
    if (!this.isOp(op)) this.fail(`${what} : « ${op} » attendu, « ${this.peek().raw} » trouvé.`);
    return this.next();
  }
  private fail(message: string, line = this.peek().line, hint?: string): never {
    throw new AlgoError("syntax", line, message, hint);
  }

  /**
   * Mot de fin de bloc en tenant compte des formes en deux mots sur la même
   * ligne : « FIN SI », « FIN POUR », « FIN TANT QUE », « FIN TANTQUE ».
   * Renvoie le mot normalisé et le nombre de jetons qu'il occupe.
   */
  private endWord(): { word: string; size: number } | null {
    const t = this.peek();
    if (t.type === "eof") return { word: "EOF", size: 0 };
    if (t.type !== "kw") return null;
    if (t.value === "FIN") {
      const n1 = this.peek(1);
      if (n1.type === "kw" && !n1.nl) {
        if (n1.value === "SI") return { word: "FINSI", size: 2 };
        if (n1.value === "POUR") return { word: "FINPOUR", size: 2 };
        if (n1.value === "TANTQUE") return { word: "FINTANTQUE", size: 2 };
        if (n1.value === "PROCEDURE") return { word: "FINPROCEDURE", size: 2 };
        if (n1.value === "FONCTION") return { word: "FINFONCTION", size: 2 };
        if (n1.value === "TANT" && this.isKw("QUE", 2)) return { word: "FINTANTQUE", size: 3 };
      }
      return { word: "FIN", size: 1 };
    }
    if (t.value === "TANT" && this.isKw("QUE", 1)) return null;
    return BLOCK_ENDS.has(t.value) ? { word: t.value, size: 1 } : null;
  }

  private consumeEnd(word: string): boolean {
    const end = this.endWord();
    if (end && end.word === word) {
      this.pos += end.size;
      return true;
    }
    return false;
  }

  // ── programme ───────────────────────────────────────────────────────────
  parseProgram(): Program {
    const program: Program = {
      name: null,
      consts: [],
      vars: [],
      routines: new Map(),
      body: [],
      line: this.peek().line,
    };
    if (this.isKw("ALGORITHME")) {
      this.next();
      const name = this.next();
      if (name.type !== "ident")
        this.fail("Donnez un nom à l'algorithme après ALGORITHME.", name.line);
      program.name = name.raw;
    }
    let mainSeen = false;
    for (;;) {
      const t = this.peek();
      if (t.type === "eof") break;
      if (this.isKw("CONSTANTES") || this.isKw("CONSTANTE")) {
        if (mainSeen) this.fail("Les CONSTANTES se déclarent avant le DEBUT de l'algorithme.");
        this.next();
        program.consts.push(...this.parseConsts());
      } else if (this.isKw("VARIABLES") || this.isKw("VARIABLE") || this.isKw("VAR")) {
        if (mainSeen) this.fail("Les VARIABLES se déclarent avant le DEBUT de l'algorithme.");
        this.next();
        program.vars.push(...this.parseVars());
      } else if (this.isKw("PROCEDURE") || this.isKw("FONCTION")) {
        const r = this.parseRoutine();
        if (program.routines.has(r.key)) {
          this.fail(`« ${r.name} » est déjà défini plus haut.`, r.line);
        }
        program.routines.set(r.key, r);
      } else if (this.isKw("DEBUT")) {
        if (mainSeen) this.fail("Un algorithme n'a qu'un seul bloc DEBUT … FIN principal.");
        const start = this.next();
        program.body = this.parseBlock();
        if (!this.consumeEnd("FIN")) this.unexpectedEnd(start, "DEBUT", "FIN");
        mainSeen = true;
      } else if (t.type === "ident" && !mainSeen) {
        this.fail(
          `« ${t.raw} » : les instructions s'écrivent entre DEBUT et FIN.`,
          t.line,
          "Ajoutez DEBUT avant la première instruction.",
        );
      } else {
        this.fail(
          mainSeen
            ? `« ${t.raw} » après le FIN de l'algorithme : rien ne doit suivre le FIN.`
            : `« ${t.raw} » inattendu ici.`,
          t.line,
        );
      }
    }
    if (!mainSeen) this.fail("L'algorithme n'a pas de bloc DEBUT … FIN.", this.peek().line);
    return program;
  }

  private parseConsts(): ConstDecl[] {
    const out: ConstDecl[] = [];
    while (this.peek().type === "ident") {
      const name = this.next();
      if (!this.acceptOp("=") && !this.acceptOp("<-")) {
        this.fail(`Constante ${name.raw} : écrivez « ${name.raw} = valeur ».`, name.line);
      }
      const value = this.parseExpr();
      let type: ScalarType | null = null;
      if (this.acceptOp(":")) type = this.parseScalarType();
      out.push({ name: name.raw, key: identKey(name.raw), value, type, line: name.line });
    }
    return out;
  }

  private parseVars(): VarDecl[] {
    const out: VarDecl[] = [];
    while (this.peek().type === "ident") {
      const names: Token[] = [this.next()];
      while (this.acceptOp(",")) {
        const n = this.next();
        if (n.type !== "ident") this.fail(`Nom de variable attendu après la virgule.`, n.line);
        names.push(n);
      }
      if (!this.acceptOp(":")) {
        this.fail(
          `Déclaration de ${names.map((n) => n.raw).join(", ")} : il manque « : TYPE ».`,
          names[0]!.line,
          "Exemple : compteur : ENTIER",
        );
      }
      const type = this.parseType();
      for (const n of names) out.push({ name: n.raw, key: identKey(n.raw), type, line: n.line });
    }
    return out;
  }

  private parseScalarType(): ScalarType {
    const t = this.next();
    if (t.type === "kw" && TYPE_NAMES.has(t.value)) return t.value as ScalarType;
    this.fail(
      `Type inconnu « ${t.raw} ». Types possibles : ENTIER, REEL, CHAINE, CARACTERE, BOOLEEN.`,
      t.line,
    );
  }

  private parseType(): TypeSpec {
    if (this.isKw("TABLEAU")) {
      this.next();
      let dims: ArrayType["dims"] = null;
      if (this.acceptOp("[")) {
        dims = [];
        do {
          const lo = this.parseExpr();
          this.expectOp("..", "Bornes du tableau (exemple TABLEAU[1..10])");
          const hi = this.parseExpr();
          dims.push({ lo, hi });
        } while (this.acceptOp(","));
        this.expectOp("]", "Bornes du tableau");
      }
      if (!this.isKw("DE")) this.fail("Tableau : écrivez « TABLEAU[1..10] DE ENTIER ».");
      this.next();
      return { kind: "array", dims, elem: this.parseScalarType() };
    }
    return { kind: "scalar", name: this.parseScalarType() };
  }

  private parseRoutine(): Routine {
    const head = this.next();
    const isFunction = head.value === "FONCTION";
    const nameTok = this.next();
    if (nameTok.type !== "ident") {
      this.fail(`Donnez un nom ${isFunction ? "à la FONCTION" : "à la PROCEDURE"}.`, nameTok.line);
    }
    const params: Param[] = [];
    if (this.acceptOp("(")) {
      let pending: Param[] = [];
      if (!this.isOp(")")) {
        for (;;) {
          const byRef = this.isKw("VAR") ? (this.next(), true) : false;
          const p = this.next();
          if (p.type !== "ident") this.fail("Nom de paramètre attendu.", p.line);
          const param: Param = {
            name: p.raw,
            key: identKey(p.raw),
            byRef,
            type: { kind: "any" },
            line: p.line,
          };
          params.push(param);
          pending.push(param);
          if (this.acceptOp(":")) {
            const type = this.parseType();
            for (const q of pending) q.type = type;
            pending = [];
          }
          if (this.acceptOp(",") || this.acceptOp(";")) continue;
          break;
        }
      }
      this.expectOp(")", `Paramètres de ${nameTok.raw}`);
    }
    let returnType: ScalarType | null = null;
    if (isFunction) {
      if (!this.acceptOp(":")) {
        this.fail(
          `La fonction ${nameTok.raw} doit annoncer le type de son résultat.`,
          nameTok.line,
          `Exemple : FONCTION ${nameTok.raw}(x : ENTIER) : ENTIER`,
        );
      }
      returnType = this.parseScalarType();
    }
    const routine: Routine = {
      kind: isFunction ? "function" : "procedure",
      name: nameTok.raw,
      key: identKey(nameTok.raw),
      params,
      returnType,
      consts: [],
      vars: [],
      body: [],
      line: head.line,
    };
    for (;;) {
      if (this.isKw("CONSTANTES") || this.isKw("CONSTANTE")) {
        this.next();
        routine.consts.push(...this.parseConsts());
      } else if (this.isKw("VARIABLES") || this.isKw("VARIABLE")) {
        this.next();
        routine.vars.push(...this.parseVars());
      } else break;
    }
    if (!this.isKw("DEBUT")) {
      this.fail(`${isFunction ? "FONCTION" : "PROCEDURE"} ${nameTok.raw} : DEBUT attendu.`);
    }
    const start = this.next();
    routine.body = this.parseBlock();
    if (!this.consumeEnd("FIN") && !this.consumeEnd(isFunction ? "FINFONCTION" : "FINPROCEDURE")) {
      this.unexpectedEnd(start, "DEBUT", "FIN");
    }
    return routine;
  }

  /** Message quand un bloc se termine par le mauvais mot. */
  private unexpectedEnd(open: Token, opener: string, closer: string): never {
    const end = this.endWord();
    const found = end?.word === "EOF" ? "la fin du texte" : `« ${this.peek().raw} »`;
    if (opener === "DEBUT") {
      this.fail(
        `${found} inattendu : le bloc DEBUT de la ligne ${open.line} doit se terminer par FIN.`,
      );
    }
    this.fail(
      `Le ${opener} de la ligne ${open.line} n'est jamais refermé : il manque un ${closer}.`,
      open.line,
      `Chaque ${opener} a son propre ${closer}.`,
    );
  }

  // ── instructions ────────────────────────────────────────────────────────
  private parseBlock(): Stmt[] {
    const out: Stmt[] = [];
    for (;;) {
      if (this.endWord()) return out;
      out.push(this.parseStatement());
    }
  }

  private parseStatement(): Stmt {
    const t = this.peek();
    if (t.type === "kw") {
      switch (t.value) {
        case "ECRIRE":
        case "AFFICHER": {
          this.next();
          const args = this.isOp("(") && !this.peek().nl ? this.parseArgs() : [];
          return { kind: "write", args, newline: t.value === "ECRIRE", line: t.line };
        }
        case "SAUTLIGNE":
          this.next();
          if (this.isOp("(") && this.isOp(")", 1)) this.pos += 2;
          return { kind: "newline", line: t.line };
        case "LIRE": {
          this.next();
          const args = this.parseArgs();
          if (args.length === 0) this.fail("LIRE attend au moins une variable : LIRE(x).", t.line);
          const targets = args.map((a) => {
            if (a.kind !== "var" && a.kind !== "index") {
              this.fail("LIRE range la saisie dans une variable : LIRE(x).", t.line);
            }
            return a as LValue;
          });
          return { kind: "read", targets, line: t.line };
        }
        case "SI":
          return this.parseIf();
        case "SINONSI":
          this.fail(
            "SINONSI n'existe pas. Écrivez SINON, puis un nouveau SI … FINSI à l'intérieur.",
            t.line,
            "Chaque SI a son propre FINSI : deux SI, deux FINSI.",
          );

        case "POUR":
          return this.parseFor();
        case "TANT":
        case "TANTQUE":
          return this.parseWhile();
        case "REPETER":
          return this.parseRepeat();
        case "RETOURNER":
        case "RENVOYER": {
          this.next();
          const value = this.peek().nl || this.endWord() ? null : this.parseExpr();
          return { kind: "return", value, line: t.line };
        }
        case "ALORS":
          this.fail("ALORS sans SI : chaque ALORS suit la condition d'un SI.", t.line);

        case "FAIRE":
          this.fail("FAIRE inattendu ici.", t.line);

        case "DEBUT":
          this.fail("DEBUT inattendu : le bloc principal est déjà ouvert.", t.line);

        default:
          if (TYPE_NAMES.has(t.value)) {
            this.fail(
              `${t.raw} est un type : les déclarations se font dans VARIABLES, avant DEBUT.`,
              t.line,
            );
          }
          this.fail(`« ${t.raw} » inattendu ici.`, t.line);
      }
    }
    if (t.type === "ident") {
      const name = this.next();
      const key = identKey(name.raw);
      if (this.isOp("<-")) {
        this.next();
        return {
          kind: "assign",
          target: { kind: "var", name: name.raw, key, line: name.line },
          value: this.parseExpr(),
          line: name.line,
        };
      }
      if (this.isOp("[")) {
        const target = this.parseIndexTail(name);
        if (this.isOp("=")) this.assignHint(name.raw);
        if (!this.acceptOp("<-"))
          this.fail(`Affectation de ${name.raw}[…] : « <- » attendu.`, name.line);
        return { kind: "assign", target, value: this.parseExpr(), line: name.line };
      }
      if (this.isOp("=")) this.assignHint(name.raw);
      if (this.isOp("(") && !this.peek().nl) {
        return { kind: "call", name: name.raw, key, args: this.parseArgs(), line: name.line };
      }
      return { kind: "call", name: name.raw, key, args: [], line: name.line };
    }
    this.fail(`« ${t.raw} » inattendu : une instruction était attendue.`, t.line);
  }

  private assignHint(name: string): never {
    this.fail(
      `Pour donner une valeur à ${name}, utilisez la flèche : ${name} <- valeur.`,
      this.peek().line,
      "Le signe = sert seulement à comparer, dans un SI ou une boucle.",
    );
  }

  private parseArgs(): Expr[] {
    const open = this.expectOp("(", "Parenthèse");
    const args: Expr[] = [];
    if (this.acceptOp(")")) return args;
    do {
      args.push(this.parseExpr());
    } while (this.acceptOp(","));
    if (!this.isOp(")")) {
      this.fail(`Parenthèse ouverte ligne ${open.line} non refermée : « ) » attendu.`, open.line);
    }
    this.next();
    return args;
  }

  private parseIf(): Stmt {
    const si = this.next();
    const cond = this.parseExpr();
    if (!this.isKw("ALORS")) {
      this.fail(
        `SI de la ligne ${si.line} : ALORS attendu après la condition.`,
        si.line,
        "Forme : SI condition ALORS … FINSI",
      );
    }
    this.next();
    const thenBlock = this.parseBlock();
    let elseBlock: Stmt[] | null = null;
    if (this.isKw("SINONSI")) this.parseStatement(); // message dédié
    if (this.isKw("SINON")) {
      this.next();
      elseBlock = this.parseBlock();
      if (this.isKw("SINON")) {
        this.fail(`Le SI de la ligne ${si.line} a déjà un SINON.`, this.peek().line);
      }
    }
    if (!this.consumeEnd("FINSI")) this.closeError(si, "SI");
    return { kind: "if", cond, then: thenBlock, else: elseBlock, line: si.line };
  }

  /** Mauvais mot de fermeture : FINSI oublié, FINPOUR à la place d'un FINSI… */
  private closeError(open: Token, opener: keyof typeof CLOSER_OF): never {
    const end = this.endWord();
    const closer = CLOSER_OF[opener]!;
    if (
      !end ||
      end.word === "EOF" ||
      end.word === "FIN" ||
      end.word === "PROCEDURE" ||
      end.word === "FONCTION"
    ) {
      this.fail(
        `Le ${opener} de la ligne ${open.line} n'est jamais refermé : il manque un ${closer}.`,
        open.line,
        opener === "SI" ? "Compte les SI et les FINSI : il en faut autant." : undefined,
      );
    }
    this.fail(
      `${this.peek().raw} inattendu ligne ${this.peek().line} : le ${opener} de la ligne ${open.line} doit d'abord être refermé par ${closer}.`,
      this.peek().line,
    );
  }

  private parseFor(): Stmt {
    const pour = this.next();
    const v = this.next();
    if (v.type !== "ident")
      this.fail("POUR : nom du compteur attendu (POUR i DE 1 A 10 FAIRE).", pour.line);
    if (!this.isKw("DE") && !this.isOp("<-")) {
      this.fail(`POUR ${v.raw} : DE attendu (POUR ${v.raw} DE 1 A 10 FAIRE).`, pour.line);
    }
    this.next();
    const from = this.parseExpr();
    const a = this.peek();
    if (!(a.type === "ident" && identKey(a.raw) === "a") && !this.isKw("JUSQUA")) {
      this.fail(
        `POUR ${v.raw} : A attendu après la valeur de départ (POUR ${v.raw} DE 1 A 10).`,
        pour.line,
      );
    }
    this.next();
    const to = this.parseExpr();
    let step: Expr | null = null;
    if (this.isKw("PAS")) {
      this.next();
      step = this.parseExpr();
    }
    if (!this.isKw("FAIRE")) this.fail(`POUR de la ligne ${pour.line} : FAIRE attendu.`, pour.line);
    this.next();
    const body = this.parseBlock();
    if (!this.consumeEnd("FINPOUR")) this.closeError(pour, "POUR");
    return {
      kind: "for",
      var: { kind: "var", name: v.raw, key: identKey(v.raw), line: v.line },
      from,
      to,
      step,
      body,
      line: pour.line,
    };
  }

  private parseWhile(): Stmt {
    const tant = this.next();
    if (tant.value === "TANT") {
      if (!this.isKw("QUE")) this.fail("Écrivez TANT QUE.", tant.line);
      this.next();
    }
    const cond = this.parseExpr();
    if (!this.isKw("FAIRE")) {
      this.fail(`TANT QUE de la ligne ${tant.line} : FAIRE attendu après la condition.`, tant.line);
    }
    this.next();
    const body = this.parseBlock();
    const endLine = this.peek().line;
    if (!this.consumeEnd("FINTANTQUE")) this.closeError(tant, "TANT QUE");
    return { kind: "while", cond, body, line: tant.line, endLine };
  }

  private parseRepeat(): Stmt {
    const rep = this.next();
    const body = this.parseBlock();
    if (!this.isKw("JUSQUA")) this.closeError(rep, "REPETER");
    this.next();
    return { kind: "repeat", body, cond: this.parseExpr(), line: rep.line };
  }

  // ── expressions ─────────────────────────────────────────────────────────
  parseExpr(): Expr {
    return this.parseOr();
  }

  private parseOr(): Expr {
    let left = this.parseAnd();
    while (this.isKw("OU")) {
      const op = this.next();
      left = { kind: "binary", op: "OU", left, right: this.parseAnd(), line: op.line };
    }
    return left;
  }

  private parseAnd(): Expr {
    let left = this.parseNot();
    while (this.isKw("ET")) {
      const op = this.next();
      left = { kind: "binary", op: "ET", left, right: this.parseNot(), line: op.line };
    }
    return left;
  }

  private parseNot(): Expr {
    if (this.isKw("NON")) {
      const op = this.next();
      return { kind: "unary", op: "NON", expr: this.parseNot(), line: op.line };
    }
    return this.parseComparison();
  }

  private parseComparison(): Expr {
    const left = this.parseAdditive();
    const t = this.peek();
    if (t.type === "op" && COMPARISON.has(t.value)) {
      this.next();
      const right = this.parseAdditive();
      const n = this.peek();
      if (n.type === "op" && COMPARISON.has(n.value)) {
        this.fail("Deux comparaisons à la suite : écrivez « a < b ET b < c ».", n.line);
      }
      return { kind: "binary", op: t.value, left, right, line: t.line };
    }
    return left;
  }

  private parseAdditive(): Expr {
    let left = this.parseMultiplicative();
    for (;;) {
      if (this.isOp("+") || this.isOp("-")) {
        const op = this.next();
        left = {
          kind: "binary",
          op: op.value,
          left,
          right: this.parseMultiplicative(),
          line: op.line,
        };
      } else return left;
    }
  }

  private parseMultiplicative(): Expr {
    let left = this.parseUnary();
    for (;;) {
      if (this.isOp("*") || this.isOp("/") || this.isKw("DIV") || this.isKw("MOD")) {
        const op = this.next();
        left = { kind: "binary", op: op.value, left, right: this.parseUnary(), line: op.line };
      } else return left;
    }
  }

  private parseUnary(): Expr {
    if (this.isOp("-")) {
      const op = this.next();
      return { kind: "unary", op: "-", expr: this.parseUnary(), line: op.line };
    }
    if (this.isOp("+")) {
      this.next();
      return this.parseUnary();
    }
    return this.parsePower();
  }

  private parsePower(): Expr {
    const base = this.parsePrimary();
    if (this.isOp("^")) {
      const op = this.next();
      return { kind: "binary", op: "^", left: base, right: this.parseUnary(), line: op.line };
    }
    return base;
  }

  private parseIndexTail(name: Token): LValue {
    const indices: Expr[] = [];
    while (this.isOp("[")) {
      const open = this.next();
      do {
        indices.push(this.parseExpr());
      } while (this.acceptOp(","));
      if (!this.acceptOp("]"))
        this.fail(`Crochet ouvert ligne ${open.line} non refermé : « ] » attendu.`, open.line);
    }
    return { kind: "index", name: name.raw, key: identKey(name.raw), indices, line: name.line };
  }

  private parsePrimary(): Expr {
    const t = this.peek();
    switch (t.type) {
      case "number":
        this.next();
        return { kind: "num", value: t.num!, isReal: !!t.isReal, line: t.line };
      case "string":
        this.next();
        return { kind: "str", value: t.value, isChar: false, line: t.line };
      case "char":
        this.next();
        return { kind: "str", value: t.value, isChar: t.value.length === 1, line: t.line };
      case "ident": {
        this.next();
        if (this.isOp("(")) {
          return {
            kind: "call",
            name: t.raw,
            key: identKey(t.raw),
            args: this.parseArgs(),
            line: t.line,
          };
        }
        if (this.isOp("[")) return this.parseIndexTail(t);
        return { kind: "var", name: t.raw, key: identKey(t.raw), line: t.line };
      }
      case "kw":
        if (t.value === "VRAI" || t.value === "FAUX") {
          this.next();
          return { kind: "bool", value: t.value === "VRAI", line: t.line };
        }
        if (TYPE_NAMES.has(t.value) && this.isOp("(", 1)) {
          this.next();
          return {
            kind: "call",
            name: t.value,
            key: t.value.toLowerCase(),
            args: this.parseArgs(),
            line: t.line,
          };
        }
        break;
      case "op":
        if (t.value === "(") {
          const open = this.next();
          const e = this.parseExpr();
          if (!this.acceptOp(")"))
            this.fail(`Parenthèse ouverte ligne ${open.line} non refermée.`, open.line);
          return e;
        }
        break;
      default:
        break;
    }
    if (t.type === "eof") this.fail("Expression incomplète à la fin du texte.", t.line);
    this.fail(`Valeur attendue, « ${t.raw} » trouvé.`, t.line);
  }
}

export function parseProgram(source: string): Program {
  return new Parser(tokenize(source)).parseProgram();
}
