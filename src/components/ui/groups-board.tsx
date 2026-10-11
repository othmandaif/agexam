"use client";

import { FileText, Info, Plus, Search, Trash2, UserRound, Users, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { IllustrationGroup } from "@/components/illustrations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { RowMenu } from "@/components/ui/row-menu";
import { IDLE } from "@/lib/action-state";
import { paths } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { deleteGroupAction } from "../server/actions";
import { GroupForm } from "./group-form";

interface GroupRow {
  id: string;
  name: string;
  label: string | null;
  memberCount: number;
  examCount: number;
}

type Tab = "all" | "active" | "empty";

export function GroupsBoard({ groups }: { groups: GroupRow[] }) {
  const [panel, setPanel] = useState(groups.length === 0);
  const [tab, setTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return groups.filter(
      (g) =>
        (tab === "all" || (tab === "active" ? g.memberCount > 0 : g.memberCount === 0)) &&
        (!term || g.name.toLowerCase().includes(term) || (g.label ?? "").toLowerCase().includes(term)),
    );
  }, [groups, tab, q]);

  const remove = (g: GroupRow) => {
    if (!window.confirm(`Supprimer le groupe ${g.name} ? Les étudiants ne sont pas supprimés.`)) return;
    setError(null);
    start(async () => {
      const fd = new FormData();
      fd.set("groupId", g.id);
      const r = await deleteGroupAction(IDLE, fd);
      if (r.status === "error") setError(r.message);
    });
  };

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: "all", label: "Tous les groupes", count: groups.length },
    { id: "active", label: "Avec étudiants", count: groups.filter((g) => g.memberCount > 0).length },
    { id: "empty", label: "Vides", count: groups.filter((g) => g.memberCount === 0).length },
  ];

  return (
    <div className={cn("grid items-start gap-6", panel && "xl:grid-cols-[minmax(0,1fr)_400px]")}>
      <div className="flex min-w-0 flex-col gap-6">
        {/* En-tête */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-card bg-lilac text-primary">
              <Users className="size-7" aria-hidden />
            </span>
            <div>
              <h1 className="text-[30px] leading-tight font-bold">Groupes</h1>
              <p className="text-[15px] text-muted">
                {groups.length} groupe{groups.length > 1 ? "s" : ""} · Gérez vos groupes
                d&apos;apprenants et affectez-les à vos examens.
              </p>
            </div>
          </div>
          {!panel ? (
            <Button onClick={() => setPanel(true)}>
              <Plus aria-hidden /> Nouveau groupe
            </Button>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="rounded-[12px] bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">
            {error}
          </p>
        ) : null}

        <section className="overflow-hidden rounded-card border border-line bg-surface shadow-soft">
          {/* Filtres */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
            <div className="flex flex-wrap gap-1.5" role="tablist">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={cn(
                    "h-9 rounded-full px-3.5 text-[13px] font-semibold transition-colors",
                    tab === t.id ? "bg-lilac text-primary" : "text-muted hover:bg-canvas hover:text-ink",
                  )}
                >
                  {t.label} <span className="opacity-70">({t.count})</span>
                </button>
              ))}
            </div>
            <label className="relative w-64 max-sm:w-full">
              <span className="sr-only">Rechercher un groupe</span>
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-faint" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un groupe…"
                className="h-10 w-full rounded-[10px] border border-line bg-surface pr-3 pl-9 text-[14px] focus:border-primary focus:shadow-[0_0_0_3px_rgba(49,91,239,0.15)] focus:outline-none"
              />
            </label>
          </div>

          {groups.length === 0 ? (
            <EmptyState
              illustration={<IllustrationGroup />}
              title="Aucun groupe"
              description="Créez votre premier groupe pour organiser vos apprenants et les affecter à vos examens."
              action={
                !panel ? (
                  <Button onClick={() => setPanel(true)}>
                    <Plus aria-hidden /> Nouveau groupe
                  </Button>
                ) : undefined
              }
            />
          ) : rows.length === 0 ? (
            <p className="border-t border-line-soft px-6 py-10 text-center text-sm text-muted">
              Aucun groupe ne correspond.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className={cn("w-full min-w-[680px] text-[14px]", pending && "opacity-60")}>
                <thead>
                  <tr className="bg-[#f8fafc] text-left text-[12px] font-semibold tracking-wide text-muted uppercase">
                    <th className="px-5 py-3">Groupe</th>
                    <th className="px-3 py-3">Étudiants</th>
                    <th className="px-3 py-3">Examens</th>
                    <th className="px-3 py-3">Statut</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((g) => (
                    <tr key={g.id} className="border-t border-line-soft transition-colors hover:bg-[#f8fafc]">
                      <td className="px-5 py-3.5">
                        <Link href={paths.group(g.id)} className="flex items-center gap-3 text-ink no-underline">
                          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-lilac text-primary">
                            <Users className="size-5" aria-hidden />
                          </span>
                          <span className="min-w-0">
                            <span className="block font-semibold">{g.name}</span>
                            <span className="block truncate text-[13px] text-muted">{g.label ?? "—"}</span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center gap-1.5">
                          <UserRound className="size-4 text-faint" aria-hidden />
                          <strong className="tabular-nums">{g.memberCount}</strong>
                          <span className="text-muted">étudiant{g.memberCount > 1 ? "s" : ""}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center gap-1.5">
                          <FileText className="size-4 text-faint" aria-hidden />
                          <strong className="tabular-nums">{g.examCount}</strong>
                          <span className="text-muted">examen{g.examCount > 1 ? "s" : ""}</span>
                        </span>
                      </td>
                      <td className="px-3 py-3.5">
                        {g.memberCount > 0 ? (
                          <Badge tone="success">
                            <span className="size-1.5 rounded-full bg-current" aria-hidden /> Actif
                          </Badge>
                        ) : (
                          <Badge tone="neutral">Vide</Badge>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <Link
                            href={paths.group(g.id)}
                            className="inline-flex h-9 items-center rounded-[10px] bg-lilac px-3.5 text-[13px] font-semibold text-primary no-underline hover:bg-[#dfe6ff]"
                          >
                            Ouvrir
                          </Link>
                          <RowMenu
                            label={`Actions pour ${g.name}`}
                            items={[
                              { label: "Ouvrir et gérer", icon: Users, href: paths.group(g.id) },
                              { label: "Supprimer", icon: Trash2, danger: true, onSelect: () => remove(g) },
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
      </div>

      {/* Panneau « Nouveau groupe » */}
      {panel ? (
        <aside className="animate-fade-in sticky top-[92px] rounded-card border border-line bg-surface p-6 shadow-md">
          <div className="mb-6 flex items-start gap-3">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-card bg-lilac text-primary">
              <Users className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[19px] font-bold">Nouveau groupe</h2>
              <p className="text-[13px] text-muted">Créez un groupe d&apos;apprenants en quelques secondes.</p>
            </div>
            {groups.length > 0 ? (
              <button
                type="button"
                aria-label="Fermer"
                onClick={() => setPanel(false)}
                className="flex size-9 items-center justify-center rounded-[10px] text-muted hover:bg-canvas hover:text-ink"
              >
                <X className="size-5" />
              </button>
            ) : null}
          </div>
          <GroupForm layout="stack" />
          <p className="mt-5 flex items-start gap-2.5 rounded-[12px] bg-canvas px-4 py-3 text-[13px] text-muted">
            <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            Après la création, ouvrez le groupe pour y ajouter des étudiants. Il pourra ensuite être
            choisi dans vos examens.
          </p>
        </aside>
      ) : null}
    </div>
  );
}