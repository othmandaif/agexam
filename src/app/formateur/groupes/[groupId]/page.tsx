import { Search, Trash2, Upload, UserMinus, Users } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineAction } from "@/components/ui/inline-action";
import { Input } from "@/components/ui/input";
import { Table, Td, Th } from "@/components/ui/table";
import { AddMembersForm } from "@/features/groups/components/add-members-form";
import { GroupForm } from "@/features/groups/components/group-form";
import { deleteGroupAction, removeMemberAction } from "@/features/groups/server/actions";
import {
  getGroup,
  listAvailableStudents,
  listGroupMembers,
} from "@/features/groups/server/queries";
import { ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { currentAcademicYear } from "@/domain/academic-year";
import { viewerOf } from "@/server/scope";

export const metadata: Metadata = { title: "Groupe" };

export default async function GroupPage({
  params,
  searchParams,
}: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const { groupId } = await params;
  const { q } = await searchParams;
  if (!z.uuid().safeParse(groupId).success) notFound();

  const group = await getGroup(user.establishmentId, groupId, viewerOf(user));
  if (!group) notFound();
  // Année passée : consultation seule. Structure du groupe : administrateur.
  const editable = group.academicYear === currentAcademicYear();
  const canManage = editable && user.role === "FORMATEUR";

  const [members, available] = await Promise.all([
    listGroupMembers(group.id),
    group.academicYear === currentAcademicYear()
      ? listAvailableStudents(user.establishmentId, group.id, q, viewerOf(user))
      : Promise.resolve([]),
  ]);

  return (
    <>
      <PageHeader
        icon={<Users aria-hidden />}
        back={{ href: ROUTES.trainer.groups, label: "Groupes" }}
        title={group.name}
        description={group.label ?? undefined}
        actions={
          <>
            {editable ? (
              <Link
                href={`${ROUTES.trainer.studentsImport}?groupe=${group.id}` as Route}
                className={buttonVariants({ variant: "outline" })}
              >
                <Upload aria-hidden /> Importer des étudiants
              </Link>
            ) : null}
            {canManage ? (
              <InlineAction
                action={deleteGroupAction}
                fields={{ groupId: group.id }}
                variant="danger"
                label={
                  <>
                    <Trash2 aria-hidden /> Supprimer
                  </>
                }
                confirmMessage={`Supprimer le groupe ${group.name} ? Les comptes des étudiants sont conservés.`}
              />
            ) : null}
          </>
        }
      />

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
          </CardHeader>
          <CardContent>
            <GroupForm group={group} />
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-start gap-6">
        <Card className="min-w-0 flex-[2_1_520px] overflow-hidden">
          <CardHeader>
            <CardTitle>Étudiants</CardTitle>
            <CardDescription>
              {members.length} membre{members.length > 1 ? "s" : ""}
            </CardDescription>
          </CardHeader>
          {members.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Groupe vide"
              description="Ajoutez des étudiants avec la liste à droite, ou importez-les depuis Excel."
            />
          ) : (
            <Table className="mt-4">
              <thead>
                <tr>
                  <Th>Nom</Th>
                  <Th>E-mail</Th>
                  <Th>Statut</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <Td className="font-semibold">{m.fullName}</Td>
                    <Td className="text-muted">{m.email}</Td>
                    <Td>
                      {!m.isActive ? (
                        <Badge tone="danger">Désactivé</Badge>
                      ) : m.mustChangePassword ? (
                        <Badge tone="warning">Jamais connecté</Badge>
                      ) : (
                        <Badge tone="success">Actif</Badge>
                      )}
                    </Td>
                    <Td className="text-right">
                      {editable ? (
                        <InlineAction
                          action={removeMemberAction}
                          fields={{ groupId: group.id, profileId: m.id }}
                          size="sm"
                          variant="ghost"
                          aria-label={`Retirer ${m.fullName} du groupe`}
                          label={<UserMinus aria-hidden />}
                          confirmMessage={`Retirer ${m.fullName} du groupe ${group.name} ?`}
                        />
                      ) : null}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        {editable ? (
          <Card className="flex-[1_1_320px]">
            <CardHeader>
              <CardTitle>Ajouter des étudiants</CardTitle>
              <CardDescription>
                Étudiants de l&apos;établissement hors de ce groupe.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <form className="flex gap-2" role="search">
                <Input
                  name="q"
                  type="search"
                  defaultValue={q}
                  placeholder="Nom ou e-mail"
                  aria-label="Rechercher un étudiant"
                  className="h-11"
                />
                <button
                  type="submit"
                  className={buttonVariants({ variant: "soft" })}
                  aria-label="Rechercher"
                >
                  <Search aria-hidden />
                </button>
              </form>
              {available.length === 0 ? (
                <p className="text-sm text-muted">
                  {q
                    ? "Aucun étudiant ne correspond à la recherche."
                    : "Tous les étudiants sont déjà dans ce groupe, ou aucun compte étudiant n'existe."}
                </p>
              ) : (
                <AddMembersForm groupId={group.id} students={available} />
              )}
              {available.length === 50 ? (
                <p className="text-xs text-muted">50 premiers résultats. Affinez la recherche.</p>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
