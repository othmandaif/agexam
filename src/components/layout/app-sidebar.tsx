"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import type { UserRole } from "@/domain/enums";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { ROUTES } from "@/lib/routes";
import { cn, initials } from "@/lib/utils";
import { sidebarNavFor } from "./navigation";

interface AppSidebarProps {
  role: UserRole;
  fullName: string;
}

export const ROLE_LABEL: Record<UserRole, string> = {
  ADMIN: "Administrateur",
  FORMATEUR: "Formateur",
  ETUDIANT: "Étudiant",
};

/** Menu latéral navy (formateur et admin), fixe sur grand écran. */
export function AppSidebar({ role, fullName }: AppSidebarProps) {
  const pathname = usePathname();
  const items = sidebarNavFor(role);

  return (
    <aside className="sticky top-0 flex h-screen w-[272px] shrink-0 flex-col overflow-hidden bg-navy px-4 py-6 text-white max-lg:hidden">
      {/* Halo décoratif très discret */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-[#16305f]/60"
      />
      <Link
        href={role === "ADMIN" ? ROUTES.admin.home : ROUTES.trainer.home}
        className="relative px-2 pb-8"
      >
        <Logo tone="inverse" size="lg" />
      </Link>
      <nav aria-label="Navigation principale" className="relative flex flex-col gap-1.5">
        {items.map(({ label, href, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-12 items-center gap-3.5 rounded-[12px] px-4 text-[15px] font-medium transition-colors duration-150",
                active
                  ? "bg-primary text-white shadow-[0_6px_20px_rgba(49,91,239,0.35)]"
                  : "text-white/75 hover:bg-white/[0.06] hover:text-white",
              )}
            >
              <Icon className="size-5" strokeWidth={1.9} aria-hidden />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1" />
      <div className="relative flex items-center gap-3 rounded-[12px] border-t border-white/10 px-2 pt-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold ring-2 ring-white/15">
          {initials(fullName)}
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-[15px] font-semibold">{fullName}</div>
          <div className="text-xs text-white/55">{ROLE_LABEL[role]}</div>
        </div>
        <SignOutButton tone="inverse" />
      </div>
    </aside>
  );
}
