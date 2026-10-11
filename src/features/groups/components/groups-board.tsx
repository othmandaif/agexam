"use client";

import { ChevronRight, FolderOpen, Info, Plus, Search, Trash2, Users, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { IllustrationGroup } from "@/components/illustrations";
import { RowMenu } from "@/components/ui/row-menu";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IDLE } from "@/lib/action-state";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { deleteGroupAction } from "../server/actions";
import { GroupForm } from "./group-form";

export interface GroupRow {
  id: string;
  name: string;
  label: string | null;
  memberCount: number;
  examCount: number;
}

type Tab = "all" | "filled" | "empty";

const TABS: { id: Tab; label: string; test: (g: GroupRow) => boolean }[] = [
  { id: "all", label: "Tous", test: () => true },
  { id: "filled", label: "Avec étudiants", test: (g) => g.memberCount > 0 },
  { id: "empty", label: "Vides", test: (g) => g.memberCount === 0 },
];

export function GroupsBoard({
  groups,
  canManage,
}: {
  groups: GroupRow[];
  /** Créer / supprimer des groupes : administrateur, année courante. */
  canManage: boolean;
}) {
  const [panel, setPanel] = useState(groups.length === 0);
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    const test = TABS.find((t) => t.id === tab)!.test;
    return groups.filter(
      (g) =>
        test(g) &&
        (!q || g.name.toLowerCase().includes(q) || (g.label ?? "").toLowerCase().includes(q)),
    );
  }, [groups, tab, search]);

  const remove = (g: GroupRow) => {
    if (!window.confirm(`Supprimer le groupe ${g.name} ?`)) return;
    setError(null);
    const fd = new FormData();
    fd.set("groupId", g.id);
    start(async () => {
      const res = await deleteGroupAction(IDLE, fd);
      if (res?.status === "error") setError(res.message);
    });
  };

  return (
    <>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-lilac text-primary">
            <Users className="size-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-[26px] leading-tight font-bold">Groupes</h1>
            <p className="text-[14px] text-muted">
              {groups.length} groupe{groups.length > 1 ? "s" : ""} · organisez vos étudiants par
              classe
            </p>
          </div>
        </div>
        {canManage ? (
          <Button variant="mint" onClick={() => setPanel(true)}>
            <Plus aria-hidden /> Nouveau groupe
          </Button>
        ) : null}
      </header>

      <div className={cn("grid items-start gap-6", panel && "lg:grid-cols-[minmax(0,1fr)_340px]")}>
        <section className="min-w-0 overflow-hidden rounded-card border border-line bg-surface shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-3.5">
            <div role="tablist" aria-label="Filtrer" className="flex gap-1">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "inline-flex h-9 items-center gap-1.5 rounded-[10px] px-3 text-[13.5px] font-semibold transition-colors",
                    tab === t.id ? "bg-primary-wash text-primary" : "text-muted hover:bg-canvas",
                  )}
                >
                  {t.label}
                  <span className="rounded-full bg-surface px-1.5 text-[11px] ring-1 ring-line">
                    {groups.filter(t.test).length}
                  </span>
                </button>
              ))}
            </div>
            <label className="relative">
              <span className="sr-only">Rechercher un groupe</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher un groupe…"
                className="h-10 w-60 rounded-[10px] border border-line bg-surface pr-3 pl-9 text-[14px] outline-none focus:border-primary"
              />
            </label>
          </div>

          {error ? (
            <p
              role="alert"
              className="mx-5 mt-4 rounded-field bg-danger-bg px-4 py-2.5 text-sm text-danger"
            >
              {error}
            </p>
          ) : null}

          {groups.length === 0 ? (
            <EmptyState
              illustration={<IllustrationGroup />}
              title="Aucun groupe"
              description="Créez un groupe (ex. DEV101), puis ajoutez-y des étudiants."
              action={
                <Button variant="mint" onClick={() => setPanel(true)}>
                  <Plus aria-hidden /> Créer un groupe
                </Button>
              }
            />
          ) : rows.length === 0 ? (
            <p className="px-6 py-12 text-center text-sm text-muted">Aucun groupe ne correspond.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className={cn("w-full min-w-[640px] text-[14px]", pending && "opacity-60")}>
                <thead>
                  <tr className="border-b border-line-soft text-left text-[12px] font-semibold tracking-wide text-muted uppercase">
                    <th className="px-5 py-3">Groupe</th>
                    <th className="px-3 py-3 text-center">Étudiants</th>
                    <th className="px-3 py-3 text-center">Examens</th>
                    <th className="px-3 py-3">Statut</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((g) => (
                    <tr
                      key={g.id}
                      className="border-b border-line-soft last:border-0 hover:bg-[#f8fafc]"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={paths.group(g.id)}
                          className="flex items-center gap-3 text-ink no-underline"
                        >
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-lilac text-[13px] font-bold text-primary">
                            {g.name.slice(0, 2).toUpperCase()}
                          </span>
                          <span className="flex min-w-0 flex-col">
                            <span className="font-semibold">{g.name}</span>
                            <span className="truncate text-[12.5px] text-muted">
                              {g.label ?? "Sans description"}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3.5 text-center font-semibold tabular-nums">
                        {g.memberCount}
                      </td>
                      <td className="px-3 py-3.5 text-center text-muted tabular-nums">
                        {g.examCount}
                      </td>
                      <td className="px-3 py-3.5">
                        {g.memberCount > 0 ? (
                          <Badge tone="success">Actif</Badge>
                        ) : (
                          <Badge tone="neutral">Vide</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            href={paths.group(g.id)}
                            className={buttonVariants({ variant: "ghost", size: "sm" })}
                          >
                            Ouvrir <ChevronRight aria-hidden />
                          </Link>
                          <RowMenu
                            label={`Actions pour ${g.name}`}
                            items={[
                              {
                                label: "Ouvrir et gérer",
                                icon: FolderOpen,
                                href: paths.group(g.id),
                              },
                              ...(canManage
                                ? [
                                    {
                                      label: "Supprimer",
                                      icon: Trash2,
                                      danger: true,
                                      onSelect: () => remove(g),
                                    },
                                  ]
                                : []),
                            ]}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {panel && canManage ? (
          <aside className="animate-fade-in sticky top-24 flex flex-col gap-4 rounded-card border border-line bg-surface p-6 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-bold">Nouveau groupe</h2>
                <p className="text-[13.5px] text-muted">Un nom court, ex. DEV101.</p>
              </div>
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setPanel(false)}
                className="flex size-8 items-center justify-center rounded-[8px] text-muted hover:bg-canvas hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
            <GroupForm layout="stack" />
            <p className="flex gap-2.5 rounded-[12px] bg-primary-wash px-4 py-3 text-[13px] text-ink-soft">
              <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              Après la création, ouvrez le groupe pour y ajouter des étudiants.
            </p>
          </aside>
        ) : null}
      </div>
    </>
  );
}
