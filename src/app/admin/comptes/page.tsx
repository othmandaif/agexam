import { ChevronRight, UserRound, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { USER_ROLES } from "@/domain/enums";
import { CreateAccountForm } from "@/features/accounts/components/create-account-form";
import { accountFiltersSchema, ROLE_LABELS } from "@/features/accounts/schemas";
import { listAccounts, listGroupOptions } from "@/features/accounts/server/queries";
import { paths } from "@/lib/routes";
import { clampPage, parsePageParams } from "@/lib/pagination";
import { requireTenant } from "@/server/auth/session";
import { getViewYear } from "@/server/year";
import { Pagination } from "@/components/ui/pagination";
import { UrlSearch, UrlSelect } from "@/components/ui/url-filters";

export const metadata: Metadata = { title: "Comptes" };

const ROLE_TONE = { ADMIN: "danger", FORMATEUR: "warning", ETUDIANT: "info" } as const;

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireTenant("ADMIN");
  const sp = await searchParams;
  const year = await getViewYear();
  const filters = { ...accountFiltersSchema.parse(sp), year, staffOnly: true };
  let pg = parsePageParams({ page: String(sp.page ?? ""), taille: String(sp.taille ?? "") });
  const [first, groupOptions] = await Promise.all([
    listAccounts(user.establishmentId, filters, { offset: pg.offset, limit: pg.size }),
    listGroupOptions(user.establishmentId, year),
  ]);
  let { rows: accounts, total } = first;
  const clamped = clampPage(pg, total);
  if (clamped.page !== pg.page) {
    pg = clamped;
    ({ rows: accounts, total } = await listAccounts(user.establishmentId, filters, {
      offset: pg.offset,
      limit: pg.size,
    }));
  }

  return (
    <>
      <PageHeader
        icon={<Users aria-hidden />}
        title="Comptes"
        description="Comptes des formateurs et des administrateurs. Les groupes et les étudiants sont gérés par chaque formateur."
      />

      <div className="flex flex-wrap items-start gap-6">
        <Card className="min-w-0 flex-[2_1_560px] overflow-hidden">
          <div className="flex flex-wrap gap-3 border-b border-line p-4" role="search">
            <UrlSearch placeholder="Nom ou e-mail" label="Rechercher un compte" />
            <UrlSelect
              param="role"
              label="Filtrer par rôle"
              allLabel="Tous les rôles"
              options={USER_ROLES.filter((r) => r !== "ETUDIANT").map((r) => ({
                value: r,
                label: ROLE_LABELS[r],
              }))}
            />
          </div>

          {accounts.length === 0 ? (
            <EmptyState
              icon={UserRound}
              title="Aucun compte trouvé"
              description="Modifiez les filtres ou créez un compte avec le formulaire."
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Nom</Th>
                  <Th>Rôle</Th>
                  <Th>Groupes</Th>
                  <Th>Statut</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id}>
                    <Td>
                      <div className="font-semibold">{a.fullName}</div>
                      <div className="text-xs text-muted">{a.email}</div>
                    </Td>
                    <Td>
                      <Badge tone={ROLE_TONE[a.role]}>{ROLE_LABELS[a.role]}</Badge>
                    </Td>
                    <Td className="text-muted">{a.groupNames ?? "—"}</Td>
                    <Td>
                      {!a.isActive ? (
                        <Badge tone="danger">Désactivé</Badge>
                      ) : a.mustChangePassword ? (
                        <Badge tone="warning">Mot de passe provisoire</Badge>
                      ) : (
                        <Badge tone="success">Actif</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={paths.account(a.id)}
                        className="inline-flex items-center gap-1 font-bold no-underline"
                        aria-label={`Gérer le compte de ${a.fullName}`}
                      >
                        Gérer <ChevronRight className="size-4" aria-hidden />
                      </Link>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
          <Pagination total={total} page={pg.page} size={pg.size} noun="comptes" />
        </Card>

        <Card className="flex-[1_1_320px]">
          <CardHeader>
            <CardTitle>Nouveau compte</CardTitle>
          </CardHeader>
          <CardContent>
            <CreateAccountForm groups={groupOptions} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
