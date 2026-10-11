import { BookOpen, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, Td, Th } from "@/components/ui/table";
import { EstablishmentForm } from "@/features/establishment/components/establishment-form";
import { ModuleForm } from "@/features/establishment/components/module-form";
import { getEstablishment, listModules } from "@/features/establishment/server/queries";
import { paths } from "@/lib/routes";
import { requireRole } from "@/server/auth/session";

export const metadata: Metadata = { title: "Référentiel" };

export default async function ReferentialPage() {
  const user = await requireRole("ADMIN");

  // Première configuration : aucun établissement encore.
  if (!user.establishmentId) {
    return (
      <>
        <PageHeader
          icon={<BookOpen aria-hidden />}
          title="Bienvenue sur AGExam"
          description="Commencez par créer votre établissement. Les modules, groupes et comptes y seront rattachés."
        />
        <Card className="max-w-2xl">
          <CardContent>
            <EstablishmentForm />
          </CardContent>
        </Card>
      </>
    );
  }

  const [establishment, moduleRows] = await Promise.all([
    getEstablishment(user.establishmentId),
    listModules(user.establishmentId),
  ]);

  return (
    <>
      <PageHeader
        title="Référentiel"
        description="Établissement, modules de formation et chapitres."
      />

      <Card>
        <CardHeader>
          <CardTitle>Établissement</CardTitle>
        </CardHeader>
        <CardContent>
          <EstablishmentForm defaultName={establishment?.name ?? ""} />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Modules</CardTitle>
          <CardDescription>
            Chaque question de la banque appartient à un module et, si besoin, à un chapitre.
          </CardDescription>
        </CardHeader>
        <CardContent className="border-b border-line-soft">
          <ModuleForm />
        </CardContent>
        {moduleRows.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="Aucun module"
            description="Ajoutez votre premier module, par exemple « M104 · Algorithmique »."
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Code</Th>
                <Th>Intitulé</Th>
                <Th>Chapitres</Th>
                <Th>Questions</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {moduleRows.map((m) => (
                <tr key={m.id}>
                  <Td className="font-mono font-bold">{m.code}</Td>
                  <Td className="font-semibold">{m.name}</Td>
                  <Td className="text-muted">{m.chapterCount}</Td>
                  <Td className="text-muted">{m.questionCount}</Td>
                  <Td className="text-right">
                    <Link
                      href={paths.module(m.id)}
                      className="inline-flex items-center gap-1 font-bold text-primary no-underline"
                    >
                      Gérer <ChevronRight className="size-4" aria-hidden />
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </>
  );
}
