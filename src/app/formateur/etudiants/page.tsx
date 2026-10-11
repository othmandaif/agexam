import {
  ChevronRight,
  Download,
  FileSpreadsheet,
  GraduationCap,
  Upload,
  UserRound,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { Table, Td, Th } from "@/components/ui/table";
import { UrlSearch, UrlSelect } from "@/components/ui/url-filters";
import { CreateAccountForm } from "@/features/accounts/components/create-account-form";
import { listAccounts, listGroupOptions } from "@/features/accounts/server/queries";
import { clampPage, parsePageParams } from "@/lib/pagination";
import { paths, ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { currentAcademicYear } from "@/domain/academic-year";
import { getViewYear } from "@/server/year";

export const metadata: Metadata = { title: "Étudiants" };

const uuid = /^[0-9a-f-]{36}$/i;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** Étudiants de l'établissement : ajout un par un, import et export Excel. */
export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 100) || undefined;
  const groupId = uuid.test(one(sp.groupe)) ? one(sp.groupe) : null;
  const year = await getViewYear();
  const pastYear = year !== currentAcademicYear();
  const filters = { role: "ETUDIANT" as const, q, groupId, year };
  let pg = parsePageParams({ page: one(sp.page), taille: one(sp.taille) });
  const [first, groups] = await Promise.all([
    listAccounts(user.establishmentId, filters, { offset: pg.offset, limit: pg.size }),
    listGroupOptions(user.establishmentId, year),
  ]);
  let { rows, total } = first;
  const clamped = clampPage(pg, total);
  if (clamped.page !== pg.page) {
    pg = clamped;
    ({ rows, total } = await listAccounts(user.establishmentId, filters, {
      offset: pg.offset,
      limit: pg.size,
    }));
  }
  // L'export reprend les filtres affichés (toutes les pages).
  const exportQuery = new URLSearchParams(
    Object.entries({ q: q ?? "", groupe: groupId ?? "" }).filter(([, v]) => v),
  ).toString();

  return (
    <>
      <PageHeader
        icon={<GraduationCap aria-hidden />}
        title="Étudiants"
        description={`Année ${year} · ajout un par un ou par fichier Excel, export de la liste.`}
        actions={
          <>
            <a
              href={paths.studentsExport(exportQuery)}
              download
              className={buttonVariants({ variant: "outline" })}
            >
              <Download aria-hidden /> Exporter Excel
            </a>
            {pastYear ? null : (
              <Link
                href={ROUTES.trainer.studentsImport}
                className={buttonVariants({ variant: "mint" })}
              >
                <Upload aria-hidden /> Importer un fichier Excel
              </Link>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-start gap-6">
        <Card className="min-w-0 flex-[2_1_560px] overflow-hidden">
          <div className="flex flex-wrap gap-3 border-b border-line p-4" role="search">
            <UrlSearch placeholder="Nom ou e-mail" label="Rechercher un étudiant" />
            <UrlSelect
              param="groupe"
              label="Filtrer par groupe"
              allLabel="Tous les groupes"
              options={groups.map((g) => ({ value: g.id, label: g.name }))}
            />
          </div>

          {rows.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title={q || groupId ? "Aucun étudiant ne correspond" : "Aucun étudiant"}
              description={
                q || groupId
                  ? "Modifiez la recherche ou le groupe."
                  : "Ajoutez un étudiant avec le formulaire ou importez un fichier Excel."
              }
            />
          ) : (
            <div className="relative overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <Th>Nom</Th>
                    <Th>Groupes</Th>
                    <Th>Compte</Th>
                    <Th>
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="transition-colors duration-150 hover:bg-[#f8fafc]">
                      <Td>
                        <div className="font-semibold">{s.fullName}</div>
                        <div className="text-xs text-muted">{s.email}</div>
                      </Td>
                      <Td className="text-muted">{s.groupNames ?? "—"}</Td>
                      <Td>
                        {!s.isActive ? (
                          <Badge tone="danger">Désactivé</Badge>
                        ) : s.mustChangePassword ? (
                          <Badge tone="warning">Jamais connecté</Badge>
                        ) : (
                          <Badge tone="success">Actif</Badge>
                        )}
                      </Td>
                      <Td className="text-right">
                        <Link
                          href={paths.studentReport(s.id)}
                          className="inline-flex items-center gap-1 font-bold whitespace-nowrap no-underline"
                          aria-label={`Fiche de ${s.fullName}`}
                        >
                          Fiche <ChevronRight className="size-4" aria-hidden />
                        </Link>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
          <Pagination total={total} page={pg.page} size={pg.size} noun="étudiants" />
        </Card>

        {pastYear ? null : (
          <div className="flex flex-[1_1_320px] flex-col gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Ajouter un étudiant</CardTitle>
                <CardDescription>
                  Un mot de passe provisoire est affiché une seule fois après l&apos;ajout.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CreateAccountForm groups={groups} studentOnly />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Plusieurs étudiants ?</CardTitle>
                <CardDescription>
                  {user.role === "ADMIN"
                    ? "Remplissez le modèle (nom complet, e-mail, groupe) puis importez-le."
                    : "Remplissez le modèle (nom complet, e-mail), puis importez-le dans un groupe."}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2.5">
                <a
                  href="/api/v1/imports/students/template"
                  download
                  className={buttonVariants({ variant: "outline" })}
                >
                  <FileSpreadsheet aria-hidden /> Modèle Excel à remplir
                </a>
                <Link
                  href={ROUTES.trainer.studentsImport}
                  className={buttonVariants({ variant: "soft" })}
                >
                  <Upload aria-hidden /> Importer
                </Link>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  );
}
