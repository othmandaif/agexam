import { CodeBlock } from "./code-block";

/** Réponse libre d'un étudiant : algorithme (code) ou texte rédigé. */
export function FreeAnswer({
  text,
  kind,
  empty = "Aucune réponse rendue.",
}: {
  text: string | null | undefined;
  kind?: "algo" | "texte" | null;
  empty?: string;
}) {
  if (!text?.trim()) {
    return <p className="rounded-field bg-canvas px-3 py-2 text-sm text-muted">{empty}</p>;
  }
  if (kind === "texte") {
    return (
      <p className="rounded-field border border-line-soft bg-canvas px-4 py-3 text-[15px] leading-relaxed whitespace-pre-wrap text-ink">
        {text}
      </p>
    );
  }
  return <CodeBlock code={text} language="PSEUDO_CODE" fontSize={13} />;
}
