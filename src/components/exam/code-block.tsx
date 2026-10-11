import type { CodeLanguage } from "@/domain/enums";
import { cn } from "@/lib/utils";

const PSEUDO_KEYWORDS = new Set([
  "algorithme",
  "variable",
  "variables",
  "constante",
  "constantes",
  "début",
  "debut",
  "fin",
  "si",
  "alors",
  "sinon",
  "sinonsi",
  "finsi",
  "tantque",
  "fintantque",
  "pour",
  "finpour",
  "à",
  "a",
  "faire",
  "répéter",
  "repeter",
  "jusqu'à",
  "jusqua",
  "selon",
  "finselon",
  "cas",
  "écrire",
  "ecrire",
  "lire",
  "retourner",
  "fonction",
  "finfonction",
  "procédure",
  "procedure",
  "finprocédure",
  "finprocedure",
  "entier",
  "réel",
  "reel",
  "chaîne",
  "chaine",
  "booléen",
  "booleen",
  "caractère",
  "caractere",
  "tableau",
  "de",
  "mod",
  "div",
  "et",
  "ou",
  "non",
  "vrai",
  "faux",
  "pas",
]);

const CODE_KEYWORDS = new Set([
  "def",
  "return",
  "if",
  "elif",
  "else",
  "for",
  "while",
  "in",
  "range",
  "print",
  "true",
  "false",
  "none",
  "null",
  "and",
  "or",
  "not",
  "import",
  "from",
  "class",
  "function",
  "const",
  "let",
  "var",
  "int",
  "float",
  "double",
  "char",
  "void",
  "public",
  "private",
  "static",
  "new",
  "select",
  "from",
  "where",
  "join",
  "on",
  "group",
  "by",
  "order",
  "insert",
  "into",
  "values",
  "update",
  "set",
  "delete",
  "create",
  "table",
  "and",
  "as",
  "count",
  "sum",
  "avg",
  "max",
  "min",
  "having",
  "distinct",
  "do",
  "break",
  "continue",
  "switch",
  "case",
]);

const TOKEN =
  /(\s+|"[^"\n]*"?|'[^'\n]*'?|\d+(?:\.\d+)?|[A-Za-zÀ-ÿ_][\wÀ-ÿ']*|←|<-|<=|>=|!=|==|[-+*/%=<>(){}[\],.;:])/g;

type Kind = "kw" | "num" | "str" | "op" | "plain";

function classify(token: string, language: CodeLanguage | null): Kind {
  if (/^\d/.test(token)) return "num";
  if (/^["']/.test(token) && token.length > 1) return "str";
  if (/^(←|<-|<=|>=|!=|==|[-+*/%=<>])$/.test(token)) return "op";
  const lower = token.toLowerCase();
  const keywords =
    language === "PSEUDO_CODE" || language === null ? PSEUDO_KEYWORDS : CODE_KEYWORDS;
  if (keywords.has(lower)) return "kw";
  return "plain";
}

const KIND_CLASS: Record<Kind, string> = {
  kw: "font-bold text-[#a9b5ff]",
  num: "text-[#ffc27a]",
  str: "text-[#ffd7a8]",
  op: "text-[#6ef2b8]",
  plain: "",
};

const LANGUAGE_LABEL: Record<CodeLanguage, string> = {
  PSEUDO_CODE: "Pseudo-code",
  PYTHON: "Python",
  JAVASCRIPT: "JavaScript",
  SQL: "SQL",
  C: "C",
  JAVA: "Java",
  AUTRE: "Code",
};

interface CodeBlockProps {
  code: string;
  language: CodeLanguage | null;
  className?: string;
  /** Taille du texte en px (boutons A− / A+ en mode examen). */
  fontSize?: number;
}

/** Bloc de code sombre avec numéros de ligne et coloration légère (pseudo-code français inclus). */
export function CodeBlock({ code, language, className, fontSize = 14 }: CodeBlockProps) {
  const lines = code.replace(/\t/g, "    ").split("\n");
  return (
    <figure className={cn("overflow-hidden rounded-xl bg-code", className)}>
      <figcaption className="border-b border-white/10 px-4 py-2 text-xs font-semibold text-[#b4bbd6]">
        {LANGUAGE_LABEL[language ?? "PSEUDO_CODE"]}
      </figcaption>
      <pre
        className="overflow-x-auto py-3 pr-4 font-mono leading-[1.7] text-[#e8ebf7]"
        style={{ fontSize }}
      >
        <code>
          {lines.map((line, i) => (
            <span key={i} className="flex">
              <span
                className="w-10 shrink-0 pr-4 text-right text-[#7a83a6] select-none"
                aria-hidden
              >
                {i + 1}
              </span>
              <span className="whitespace-pre">
                {line === ""
                  ? " "
                  : (line.match(TOKEN) ?? [line]).map((token, j) => {
                      const kind = classify(token, language);
                      return kind === "plain" ? (
                        token
                      ) : (
                        <span key={j} className={KIND_CLASS[kind]}>
                          {token}
                        </span>
                      );
                    })}
              </span>
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
