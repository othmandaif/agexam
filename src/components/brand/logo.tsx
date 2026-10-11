import Image from "next/image";
import { cn } from "@/lib/utils";

interface LogoProps {
  /** "brand" sur fond clair, "inverse" sur le menu navy. */
  tone?: "brand" | "inverse";
  /** Taille de la marque : "md" (barres) ou "lg" (connexion, menu). */
  size?: "md" | "lg";
  className?: string;
}

/** Logo officiel AGExam (fichier fourni, fond détouré). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/agexam-icon.png"
      alt=""
      width={96}
      height={96}
      priority
      className={cn("size-10 shrink-0 object-contain", className)}
    />
  );
}

/** Logo + nom « AGExam », couleurs du logo officiel (AGE bleu, xam foncé). */
export function Logo({ tone = "brand", size = "md", className }: LogoProps) {
  const inverse = tone === "inverse";
  const lg = size === "lg";
  return (
    <span className={cn("inline-flex items-center", lg ? "gap-3" : "gap-2.5", className)}>
      <LogoMark className={lg ? "size-11" : "size-9"} />
      <span
        aria-hidden
        className={cn(
          "leading-none font-extrabold tracking-[-0.025em]",
          lg ? "text-[25px]" : "text-[21px]",
          inverse ? "text-white" : "text-ink",
        )}
      >
        <span className={inverse ? "text-[#7ea3ff]" : "text-primary"}>AGE</span>xam
      </span>
      <span className="sr-only">AGExam</span>
    </span>
  );
}
