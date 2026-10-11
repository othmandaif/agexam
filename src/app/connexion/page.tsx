import type { Metadata } from "next";
import { Logo } from "@/components/brand/logo";
import { LoginForm } from "@/features/auth/components/login-form";
import { safeInternalPath } from "@/lib/routes";

export const metadata: Metadata = { title: "Connexion" };

/** Illustration : ordinateur avec un QCM (SVG maison). */
function LoginIllustration() {
  return (
    <svg viewBox="0 0 420 300" className="h-auto w-full max-w-[460px]" aria-hidden>
      <ellipse cx="230" cy="170" rx="190" ry="120" fill="#e9eeff" />
      <rect x="110" y="60" width="250" height="160" rx="14" fill="#1b2a5e" />
      <rect x="120" y="70" width="230" height="140" rx="8" fill="#fff" />
      <rect x="136" y="86" width="60" height="6" rx="3" fill="#315bef" />
      <rect x="200" y="86" width="40" height="6" rx="3" fill="#c7d4ff" />
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <circle
            cx="146"
            cy={112 + i * 24}
            r="6"
            fill={i === 1 ? "#315bef" : "none"}
            stroke={i === 1 ? "#315bef" : "#c7d4ff"}
            strokeWidth="2"
          />
          <rect
            x="160"
            y={109 + i * 24}
            width={i === 1 ? 92 : 70 - i * 6}
            height="6"
            rx="3"
            fill={i === 1 ? "#9fb5ff" : "#dfe6fb"}
          />
        </g>
      ))}
      <rect x="276" y="98" width="62" height="78" rx="6" fill="#f4f6ff" />
      {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
        <rect
          key={i}
          x={282 + (i % 3) * 19}
          y={104 + Math.floor(i / 3) * 18}
          width="13"
          height="12"
          rx="3"
          fill={i === 4 ? "#315bef" : "#fff"}
          stroke="#c7d4ff"
        />
      ))}
      <rect x="290" y="186" width="48" height="14" rx="7" fill="#315bef" />
      <path d="M86 222h298l-16 16H102z" fill="#c9d4f6" />
      <rect x="44" y="200" width="78" height="14" rx="3" fill="#315bef" />
      <rect x="40" y="214" width="86" height="14" rx="3" fill="#2a9d8f" />
      <path d="M70 200c-6-30 4-52 18-60-2 22 2 40-8 60z" fill="#3ccf9a" />
      <path d="M86 200c8-26 24-38 38-40-8 18-18 32-30 40z" fill="#26b583" />
      <rect
        x="200"
        y="20"
        width="52"
        height="56"
        rx="10"
        fill="#fff"
        stroke="#dbe4ff"
        strokeWidth="2"
      />
      <rect x="212" y="34" width="28" height="4" rx="2" fill="#315bef" />
      <rect x="212" y="44" width="22" height="4" rx="2" fill="#c7d4ff" />
      <circle cx="244" cy="66" r="10" fill="#315bef" />
      <path
        d="m239 66 4 4 7-7"
        fill="none"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M352 36l24-8-8 24-5-11z" fill="#315bef" />
    </svg>
  );
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  const safeNext = safeInternalPath(Array.isArray(next) ? next[0] : next) ?? undefined;

  return (
    <div className="flex min-h-screen flex-wrap bg-surface">
      <section className="relative flex min-h-[420px] flex-[1_1_600px] flex-col gap-10 overflow-hidden bg-hero px-16 py-12 max-sm:min-h-0 max-sm:px-6 max-sm:py-8">
        <Logo size="lg" />
        <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
          <h2 className="text-[40px] leading-[1.15] font-extrabold tracking-[-0.02em] text-ink max-sm:text-[28px]">
            Plateforme des <span className="text-primary">examens en ligne</span>
          </h2>
          <div className="w-full max-w-[420px] max-sm:hidden">
            <LoginIllustration />
          </div>
        </div>
      </section>

      <section className="flex flex-[1_1_480px] items-center justify-center px-8 py-12">
        <LoginForm next={safeNext} />
      </section>
    </div>
  );
}
