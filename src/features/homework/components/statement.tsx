import { cn } from "@/lib/utils";

/** Ligne de pseudo-code dans un énoncé : indentée (« ␣␣POUR i … » ou « ␣1  LIRE(n) »). */
const CODE_LINE = /^(\s{2,}\S|\s+\d{1,3}\s+\S)/;

type Block = { kind: "text" | "code"; lines: string[] };

function blocksOf(text: string): Block[] {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r/g, "").split("\n")) {
    const kind = CODE_LINE.test(raw) ? "code" : "text";
    const last = blocks.at(-1);
    if (last && last.kind === kind) last.lines.push(raw);
    else blocks.push({ kind, lines: [raw] });
  }
  return blocks;
}

/**
 * Énoncé lisible : paragraphes, et blocs de code (lignes indentées ou numérotées)
 * affichés comme un vrai extrait d'algorithme, numéros en marge.
 */
export function Statement({ text, className }: { text: string; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 text-[15.5px] leading-relaxed text-ink", className)}>
      {blocksOf(text.trim()).map((b, i) => {
        if (b.kind === "text") {
          const content = b.lines.join("\n").trim();
          return content ? (
            <p key={i} className="m-0 whitespace-pre-wrap">
              {content}
            </p>
          ) : null;
        }
        const numbered = b.lines.every((l) => /^\s*\d{1,3}\s/.test(l));
        const indent = Math.min(...b.lines.map((l) => l.match(/^\s*/)![0].length));
        return (
          <ol
            key={i}
            className="m-0 list-none overflow-x-auto rounded-[12px] border border-[#1e293b] bg-[#0f172a] py-2.5 font-mono text-[13.5px] leading-[1.7] text-[#e2e8f0]"
          >
            {b.lines.map((line, k) => {
              const m = numbered ? /^\s*(\d{1,3})\s(.*)$/.exec(line) : null;
              const no = m ? m[1] : String(k + 1);
              const code = m ? m[2]! : line.slice(indent);
              return (
                <li key={k} className="flex gap-4 px-4 whitespace-pre">
                  <span className="w-6 shrink-0 text-right text-[#64748b] select-none">{no}</span>
                  <span>{code || " "}</span>
                </li>
              );
            })}
          </ol>
        );
      })}
    </div>
  );
}
