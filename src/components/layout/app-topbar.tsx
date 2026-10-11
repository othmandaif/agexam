"use client";

import { ChevronDown, LayoutDashboard, LogOut, Menu, Search, UserRound, X } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { startNavProgress } from "@/components/navigation/nav-progress";
import { readNavHistory } from "@/components/navigation/nav-tracker";
import type { UserRole } from "@/domain/enums";
import { signOutAction } from "@/features/auth/actions";
import { ROUTES } from "@/lib/routes";
import { cn, initials } from "@/lib/utils";
import { ROLE_LABEL } from "./app-sidebar";
import { sidebarNavFor } from "./navigation";

/** Barre du haut : recherche globale (Ctrl + K), menu utilisateur, menu mobile. */
export function AppTopbar({
  role,
  fullName,
  yearSwitcher,
}: {
  role: UserRole;
  fullName: string;
  /** Sélecteur d'année scolaire (rendu côté serveur). */
  yearSwitcher?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Ctrl + K / ⌘ + K : focus sur la recherche.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setMenuOpen(false);
        setDrawer(false);
      }
    };
    const onClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, []);

  const home = role === "ADMIN" ? ROUTES.admin.home : ROUTES.trainer.home;
  const SEARCH_PATH = "/formateur/recherche";
  const onSearchPage = pathname === SEARCH_PATH;

  // Sur la page de résultats : la barre affiche le terme recherché.
  useEffect(() => {
    if (!onSearchPage) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation avec l'URL
    setQ(new URLSearchParams(window.location.search).get("q") ?? "");
  }, [onSearchPage, pathname]);

  /** Efface la recherche ; depuis la page de résultats, retour à la page d'avant. */
  const cancelSearch = () => {
    setQ("");
    if (onSearchPage) {
      const back = readNavHistory()
        .reverse()
        .find((u) => u.split("?")[0] !== SEARCH_PATH);
      startNavProgress();
      router.push((back ?? home) as Route);
    } else {
      inputRef.current?.focus();
    }
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
      <div className="flex h-[68px] items-center gap-4 px-8 max-sm:px-4">
        <button
          type="button"
          className="flex size-10 items-center justify-center rounded-[10px] text-ink hover:bg-canvas lg:hidden"
          aria-label="Ouvrir le menu"
          onClick={() => setDrawer(true)}
        >
          <Menu className="size-5" />
        </button>
        <form
          role="search"
          className="relative w-full max-w-[560px]"
          onSubmit={(e) => {
            e.preventDefault();
            const term = q.trim();
            if (!term) return;
            startNavProgress();
            router.push(`/formateur/recherche?q=${encodeURIComponent(term)}` as Route);
          }}
        >
          <label htmlFor="global-search" className="sr-only">
            Rechercher
          </label>
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-faint" />
          <input
            ref={inputRef}
            id="global-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && (q || onSearchPage)) {
                e.stopPropagation();
                cancelSearch();
              }
            }}
            placeholder="Rechercher un examen, une question, un groupe…"
            className="h-11 w-full rounded-[12px] border border-line bg-canvas pr-20 pl-10 text-[14px] text-ink transition-shadow focus:border-primary focus:bg-surface focus:shadow-[0_0_0_3px_rgba(49,91,239,0.15)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {q || onSearchPage ? (
            <button
              type="button"
              onClick={cancelSearch}
              aria-label={onSearchPage ? "Annuler la recherche et revenir" : "Effacer la recherche"}
              title={onSearchPage ? "Annuler et revenir à la page précédente" : "Effacer"}
              className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-muted transition-colors duration-150 hover:bg-line-soft hover:text-ink"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : (
            <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded-md border border-line bg-surface px-1.5 py-0.5 font-sans text-[11px] font-semibold text-muted max-sm:hidden">
              Ctrl + K
            </kbd>
          )}
        </form>
        <div className="flex-1" />
        {yearSwitcher ? <div className="max-md:hidden">{yearSwitcher}</div> : null}
        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2.5 rounded-[12px] py-1.5 pr-2 pl-1.5 transition-colors hover:bg-canvas"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
              {initials(fullName)}
            </span>
            <span className="text-[14px] font-semibold max-sm:hidden">
              {fullName.split(" ")[0]}
            </span>
            <ChevronDown className="size-4 text-muted" aria-hidden />
          </button>
          {menuOpen ? (
            <div
              role="menu"
              className="animate-fade-in absolute right-0 mt-2 w-60 overflow-hidden rounded-card border border-line bg-surface p-1.5 shadow-md"
            >
              <div className="px-3 py-2.5">
                <div className="truncate text-sm font-semibold">{fullName}</div>
                <div className="text-xs text-muted">{ROLE_LABEL[role]}</div>
              </div>
              <div className="my-1 h-px bg-line-soft" />
              <Link
                role="menuitem"
                href={home}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm text-ink no-underline hover:bg-canvas"
              >
                <LayoutDashboard className="size-4 text-muted" /> Tableau de bord
              </Link>
              <Link
                role="menuitem"
                href={ROUTES.account.password}
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-sm text-ink no-underline hover:bg-canvas"
              >
                <UserRound className="size-4 text-muted" /> Mot de passe
              </Link>
              <form action={signOutAction}>
                <button
                  role="menuitem"
                  type="submit"
                  className="flex w-full items-center gap-2.5 rounded-[10px] px-3 py-2 text-left text-sm text-danger hover:bg-danger-bg"
                >
                  <LogOut className="size-4" /> Se déconnecter
                </button>
              </form>
            </div>
          ) : null}
        </div>
      </div>

      {/* Menu mobile (tiroir) */}
      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-[rgba(15,23,42,0.35)]"
            onClick={() => setDrawer(false)}
          />
          <div className="animate-fade-in absolute inset-y-0 left-0 flex w-[280px] flex-col bg-navy px-4 py-5 text-white">
            <div className="flex items-center justify-between px-2 pb-6">
              <Logo tone="inverse" />
              <button
                type="button"
                aria-label="Fermer le menu"
                onClick={() => setDrawer(false)}
                className="flex size-9 items-center justify-center rounded-[10px] text-white/70 hover:bg-white/10"
              >
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1.5">
              {sidebarNavFor(role).map(({ label, href, icon: Icon, exact }) => {
                const active = exact ? pathname === href : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setDrawer(false)}
                    className={cn(
                      "flex h-12 items-center gap-3.5 rounded-[12px] px-4 text-[15px] font-medium",
                      active ? "bg-primary text-white" : "text-white/75 hover:bg-white/[0.06]",
                    )}
                  >
                    <Icon className="size-5" aria-hidden /> {label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      ) : null}
    </header>
  );
}
