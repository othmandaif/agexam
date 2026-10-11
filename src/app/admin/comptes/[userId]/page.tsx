import { Power, PowerOff, UserRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineAction } from "@/components/ui/inline-action";
import {
  AccountNameForm,
  AccountRoleForm,
  ResetPasswordForm,
} from "@/features/accounts/components/account-forms";
import { ROLE_LABELS } from "@/features/accounts/schemas";
import { setActiveAction } from "@/features/accounts/server/actions";
import { getAccount } from "@/features/accounts/server/queries";
import { paths, ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";

export const metadata: Metadata = { title: "Compte" };

const dateFormat = new Intl.DateTimeFormat("fr-MA", { dateStyle: "long" });

export default async function AccountPage({ params }: { params: Promise<{ userId: string }> }) {
  const user = await requireTenant("ADMIN");
  const { userId } = await params;
  if (!z.uuid().safeParse(userId).success) notFound();

  const account = await getAccount(user.establishmentId, userId);
  if (!account) notFound();
  const isSelf = account.id === user.id;

  return (
    <>
      <PageHeader
        icon={<UserRound aria-hidden />}
        back={{ href: ROUTES.admin.accounts, label: "Comptes" }}
        title={account.fullName}
        description={`${account.email} · créé le ${dateFormat.format(account.createdAt)}`}
        actions={
          !isSelf ? (
            <InlineAction
              action={setActiveAction}
              fields={{ userId: account.id, active: String(!account.isActive) }}
              variant={account.isActive ? "danger" : "outline"}
              label={
                account.isActive ? (
                  <>
                    <PowerOff aria-hidden /> Désactiver
                  </>
                ) : (
                  <>
                    <Power aria-hidden /> Réactiver
                  </>
                )
              }
              confirmMessage={
                account.isActive
                  ? `Désactiver le compte de ${account.fullName} ? Il ne pourra plus se connecter.`
                  : `Réactiver le compte de ${account.fullName} ?`
              }
            />
          ) : null
        }
      />

      <div className="flex flex-wrap gap-2">
        <Badge tone="info">{ROLE_LABELS[account.role]}</Badge>
        {!account.isActive ? <Badge tone="danger">Désactivé</Badge> : null}
        {account.mustChangePassword ? (
          <Badge tone="warning">Mot de passe provisoire non changé</Badge>
        ) : null}
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(320px,1fr))] gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Identité</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <AccountNameForm userId={account.id} fullName={account.fullName} />
            <AccountRoleForm userId={account.id} role={account.role} disabled={isSelf} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Connexion</CardTitle>
            <CardDescription>
              Un mot de passe provisoire est généré. L&apos;utilisateur devra le changer à sa
              prochaine connexion.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResetPasswordForm
              userId={account.id}
              fullName={account.fullName}
              email={account.email}
            />
          </CardContent>
        </Card>

        {account.role === "ETUDIANT" ? (
          <Card>
            <CardHeader>
              <CardTitle>Groupes</CardTitle>
              <CardDescription>
                Les membres se gèrent depuis la page de chaque groupe.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {account.groups.length === 0 ? (
                <p className="text-sm text-muted">Membre d&apos;aucun groupe.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {account.groups.map((g) => (
                    <li key={g.id}>
                      <Link
                        href={paths.group(g.id)}
                        className="inline-flex h-8 items-center rounded-full bg-lilac px-3 text-sm font-bold text-primary-strong no-underline"
                      >
                        {g.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
