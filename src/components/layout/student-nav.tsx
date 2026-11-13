"use client";

import { ClipboardCheck, ClipboardList, Code2 } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: ROUTES.student.home, label: "Mes examens", icon: ClipboardList },
  { href: ROUTES.student.training, label: "Entraînement", icon: Code2 },
  { href: ROUTES.student.homework, label: "Devoirs", icon: ClipboardCheck },
] as const;

const SECTIONS = [ROUTES.student.training, ROUTES.student.homework] as const;

export function StudentNav() {
  const pathname = usePathname();
  const section = SECTIONS.find((p) => pathname.startsWith(p)) ?? ROUTES.student.home;
  return (
    <nav aria-label="Navigation étudiant" className="flex h-full flex-1 gap-7">
      {ITEMS.map(({ href, label, icon: Icon }) => {
        const active = href === section;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-full items-center gap-2 border-b-2 text-[14px] font-semibold no-underline transition-colors",
              active
                ? "border-primary text-primary"
                : "border-transparent text-muted hover:text-ink",
            )}
          >
            <Icon className="size-[18px]" aria-hidden />{" "}
            <span className="max-sm:hidden">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
