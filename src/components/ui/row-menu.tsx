"use client";

import type { LucideIcon } from "lucide-react";
import { MoreHorizontal } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export interface RowMenuItem {
  label: string;
  icon?: LucideIcon;
  href?: Route | string;
  /** Téléchargement (route API) : simple lien, pas de navigation client. */
  download?: boolean;
  onSelect?: () => void;
  danger?: boolean;
}

const MENU_W = 220;
const GAP = 6;

/**
 * Menu « … » d'une ligne de tableau. Rendu dans un portail en position fixe :
 * jamais rogné par le défilement horizontal du tableau ; s'ouvre vers le haut
 * s'il manque de place en bas.
 */
export function RowMenu({ items, label = "Actions" }: { items: RowMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const place = useCallback(() => {
    const btn = btnRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const h = menuRef.current?.offsetHeight ?? items.length * 38 + 12;
    const below = window.innerHeight - r.bottom;
    const top = below < h + GAP && r.top > h + GAP ? r.top - h - GAP : r.bottom + GAP;
    const left = Math.min(Math.max(8, r.right - MENU_W), window.innerWidth - MENU_W - 8);
    setPos({ top, left });
  }, [items.length]);

  // Position calculée avant affichage (pas de saut visuel).
  useLayoutEffect(() => {
    if (open) place();
  }, [open, place]);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btnRef.current?.contains(t) && !menuRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close();
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    // Défilement de la page ou du tableau : le menu suit le bouton.
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", close);
    menuRef.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", close);
    };
  }, [open, place]);

  const itemCls = (danger?: boolean) =>
    cn(
      "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-[13.5px] font-medium no-underline transition-colors duration-150 outline-none [&_svg]:size-4",
      danger
        ? "text-danger hover:bg-danger-bg focus-visible:bg-danger-bg"
        : "text-ink hover:bg-canvas focus-visible:bg-canvas",
    );

  const menu =
    open && pos ? (
      <div
        ref={menuRef}
        role="menu"
        aria-label={label}
        style={{ top: pos.top, left: pos.left, width: MENU_W }}
        className="animate-fade-in fixed z-50 rounded-[12px] border border-line bg-surface p-1.5 shadow-[0_12px_32px_rgba(13,33,72,0.16)]"
      >
        {items.map((item) => {
          const Icon = item.icon;
          const body = (
            <>
              {Icon ? <Icon aria-hidden /> : null}
              {item.label}
            </>
          );
          if (item.href && item.download) {
            return (
              <a
                key={item.label}
                role="menuitem"
                href={item.href}
                download
                className={itemCls(item.danger)}
                onClick={() => setOpen(false)}
              >
                {body}
              </a>
            );
          }
          return item.href ? (
            <Link
              key={item.label}
              role="menuitem"
              href={item.href as Route}
              className={itemCls(item.danger)}
              onClick={() => setOpen(false)}
            >
              {body}
            </Link>
          ) : (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className={itemCls(item.danger)}
              onClick={() => {
                setOpen(false);
                item.onSelect?.();
              }}
            >
              {body}
            </button>
          );
        })}
      </div>
    ) : null;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex size-8 items-center justify-center rounded-[8px] text-muted transition-colors duration-150 hover:bg-canvas hover:text-ink",
          open && "bg-canvas text-ink",
        )}
      >
        <MoreHorizontal className="size-[18px]" aria-hidden />
      </button>
      {menu ? createPortal(menu, document.body) : null}
    </>
  );
}
