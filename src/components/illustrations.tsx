/**
 * Illustrations minimales AGExam (SVG, bleu + touches discrètes).
 * Décoratives : toujours aria-hidden.
 */
const BLOB = "#eef2ff";

export function IllustrationExam({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 150" className={className} aria-hidden>
      <ellipse cx="110" cy="80" rx="82" ry="62" fill={BLOB} />
      <circle cx="176" cy="34" r="6" fill="#dbe4ff" />
      <circle cx="40" cy="44" r="4" fill="#dbe4ff" />
      <rect
        x="66"
        y="34"
        width="72"
        height="92"
        rx="10"
        fill="#fff"
        stroke="#315bef"
        strokeWidth="3"
      />
      <rect x="88" y="26" width="28" height="14" rx="5" fill="#315bef" />
      <rect x="80" y="58" width="44" height="6" rx="3" fill="#c7d4ff" />
      <rect x="80" y="74" width="34" height="6" rx="3" fill="#c7d4ff" />
      <rect x="80" y="90" width="40" height="6" rx="3" fill="#c7d4ff" />
      <rect
        x="120"
        y="86"
        width="40"
        height="38"
        rx="8"
        fill="#fff"
        stroke="#315bef"
        strokeWidth="3"
      />
      <path d="M120 98h40" stroke="#315bef" strokeWidth="3" />
      <circle cx="140" cy="111" r="6" fill="none" stroke="#315bef" strokeWidth="2.5" />
      <path d="M140 108v3l2 1.5" stroke="#315bef" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M170 70l10-6M172 82h11M168 94l9 5"
        stroke="#315bef"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IllustrationGroup({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 150" className={className} aria-hidden>
      <ellipse cx="110" cy="80" rx="80" ry="58" fill={BLOB} />
      <circle cx="150" cy="40" r="10" fill="#dbe4ff" />
      <circle cx="94" cy="66" r="16" fill="#fff" stroke="#315bef" strokeWidth="3.5" />
      <path
        d="M64 112c4-18 16-26 30-26s26 8 30 26"
        fill="#fff"
        stroke="#315bef"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <circle cx="126" cy="72" r="12" fill="#fff" stroke="#315bef" strokeWidth="3" />
      <path
        d="M118 90c12-2 26 6 28 20"
        fill="none"
        stroke="#315bef"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="150" cy="106" r="15" fill="#315bef" />
      <path d="M150 99v14M143 106h14" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function IllustrationQuestions({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 150" className={className} aria-hidden>
      <ellipse cx="110" cy="80" rx="80" ry="58" fill={BLOB} />
      <rect
        x="60"
        y="40"
        width="100"
        height="22"
        rx="8"
        fill="#fff"
        stroke="#c7d4ff"
        strokeWidth="2.5"
      />
      <rect
        x="60"
        y="68"
        width="100"
        height="22"
        rx="8"
        fill="#fff"
        stroke="#315bef"
        strokeWidth="3"
      />
      <rect
        x="60"
        y="96"
        width="100"
        height="22"
        rx="8"
        fill="#fff"
        stroke="#c7d4ff"
        strokeWidth="2.5"
      />
      <circle cx="72" cy="79" r="5" fill="#315bef" />
      <circle cx="72" cy="51" r="5" fill="none" stroke="#c7d4ff" strokeWidth="2" />
      <circle cx="72" cy="107" r="5" fill="none" stroke="#c7d4ff" strokeWidth="2" />
      <rect x="84" y="76" width="50" height="6" rx="3" fill="#c7d4ff" />
      <circle cx="166" cy="40" r="14" fill="#18b981" />
      <path
        d="m159 40 5 5 9-10"
        fill="none"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Bandeau du tableau de bord : ordinateur + validation. */
export function IllustrationDashboard({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 360 170" className={className} aria-hidden>
      <ellipse cx="220" cy="100" rx="140" ry="70" fill={BLOB} />
      <rect x="168" y="40" width="150" height="96" rx="10" fill="#2447c7" />
      <rect x="176" y="48" width="134" height="80" rx="6" fill="#fff" />
      <circle cx="192" cy="68" r="5" fill="none" stroke="#315bef" strokeWidth="2" />
      <rect x="204" y="65" width="70" height="6" rx="3" fill="#c7d4ff" />
      <circle cx="192" cy="88" r="5" fill="#315bef" />
      <rect x="204" y="85" width="86" height="6" rx="3" fill="#c7d4ff" />
      <circle cx="192" cy="108" r="5" fill="none" stroke="#315bef" strokeWidth="2" />
      <rect x="204" y="105" width="56" height="6" rx="3" fill="#c7d4ff" />
      <path d="M150 140h186l-10 10H160z" fill="#dbe4ff" />
      <rect
        x="96"
        y="120"
        width="70"
        height="24"
        rx="4"
        fill="#fff"
        stroke="#dbe4ff"
        strokeWidth="2"
      />
      <circle cx="132" cy="48" r="24" fill="#fff" />
      <circle cx="132" cy="48" r="17" fill="#18b981" />
      <path
        d="m124 48 6 6 11-12"
        fill="none"
        stroke="#fff"
        strokeWidth="3.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M262 18l18-6-6 18-4-8z" fill="#315bef" />
    </svg>
  );
}

/** Calendrier vide (étudiant : rien de prévu). */
export function IllustrationCalendar({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 150" className={className} aria-hidden>
      <ellipse cx="110" cy="80" rx="78" ry="56" fill={BLOB} />
      <rect
        x="70"
        y="40"
        width="80"
        height="74"
        rx="12"
        fill="#fff"
        stroke="#315bef"
        strokeWidth="3.5"
      />
      <path d="M70 60h80" stroke="#315bef" strokeWidth="3.5" />
      <path d="M90 32v14M130 32v14" stroke="#315bef" strokeWidth="3.5" strokeLinecap="round" />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}${c}`}
            x={84 + c * 18}
            y={70 + r * 13}
            width="10"
            height="7"
            rx="2"
            fill="#c7d4ff"
          />
        )),
      )}
      <circle cx="148" cy="110" r="16" fill="#315bef" />
      <path d="M148 102v8l5 4" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
