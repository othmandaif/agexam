import { BookOpen, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineAction } from "@/components/ui/inline-action";
import { ChapterCreateForm, ChapterRow } from "@/features/establishment/components/chapter-forms";
import { ModuleForm } from "@/features/establishment/components/module-form";
import { deleteModuleAction } from "@/features/establishment/server/actions";
import { getModuleWithChapters } from "@/features/establishment/server/queries";
import { ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";

export const metadata: Metadata = { title: "Module" };

export default async function ModulePage({ params }: { params: Promise<{ moduleId: string }> }) {
  const user = await requireTenant("ADMIN");
  const { moduleId } = await params;
  if (!z.uuid().safeParse(moduleId).success) notFound();

  const moduleData = await getModuleWithChapters(user.establishmentId, moduleId);
  if (!moduleData) notFound();

  const questionTotal = moduleData.chapters.reduce((sum, c) => sum + c.questionCount, 0);

  return (
    <>
      <PageHeader
        icon={<BookOpen aria-hidden />}
        back={{ href: ROUTES.admin.referential, label: "Référentiel" }}
        title={`${moduleData.code} · ${moduleData.name}`}
        actions={
          <InlineAction
            action={deleteModuleAction}
            fields={{ moduleId: moduleData.id }}
            variant="danger"
            label={
              <>
                <Trash2 aria-hidden /> Supprimer le module
              </>
            }
            confirmMessage={`Supprimer le module ${moduleData.code} et ses chapitres ? Impossible s'il contient des questions.`}
          />
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent>
          <ModuleForm
            module={{ id: moduleData.id, code: moduleData.code, name: moduleData.name }}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Chapitres</CardTitle>
          <CardDescription>
            {moduleData.chapters.length} chapitre{moduleData.chapters.length > 1 ? "s" : ""} ·{" "}
            {questionTotal} question{questionTotal > 1 ? "s" : ""} classée
            {questionTotal > 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {moduleData.chapters.length > 0 ? (
            <ul className="flex flex-col">
              {moduleData.chapters.map((chapter) => (
                <ChapterRow key={chapter.id} chapter={chapter} />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Aucun chapitre pour l&apos;instant.</p>
          )}
          <ChapterCreateForm moduleId={moduleData.id} />
        </CardContent>
      </Card>
    </>
  );
}
