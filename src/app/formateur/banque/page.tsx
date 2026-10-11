import { Database, Library, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { BankFilterBar } from "@/features/bank/components/bank-filter-bar";
import { BankList } from "@/features/bank/components/bank-list";
import { parseBankFilters } from "@/features/bank/schemas";
import { listBankQuestions } from "@/features/bank/server/queries";
import { getModuleWithChapters, listModules } from "@/features/establishment/server/queries";
import { ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";

export const metadata: Metadata = { title: "Banque de questions" };

export default async function QuestionBankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const filters = parseBankFilters(await searchParams);
  const [modules, moduleDetail, result] = await Promise.all([
    listModules(user.establishmentId),
    filters.moduleId ? getModuleWithChapters(user.establishmentId, filters.moduleId) : null,
    listBankQuestions(user, filters),
  ]);
  const filtered =
    !!filters.q || !!filters.moduleId || !!filters.type || !!filters.difficulty || filters.archived;

  return (
    <>
      <PageHeader
        icon={<Database aria-hidden />}
        title="Banque de questions"
        description="Toutes les questions des examens de l'établissement, avec leurs résultats. Une question identique tapée dans un autre examen est reconnue et reliée automatiquement."
        actions={
          <Link href={ROUTES.trainer.newExam} className={buttonVariants({ variant: "primary" })}>
            <Plus aria-hidden /> Nouvel examen
          </Link>
        }
      />
      <BankFilterBar filters={filters} modules={modules} chapters={moduleDetail?.chapters ?? []} />
      {result.items.length === 0 ? (
        <div className="rounded-card border border-line bg-surface">
          <EmptyState
            icon={Library}
            title={filtered ? "Aucune question ne correspond" : "La banque est vide"}
            description={
              filtered
                ? "Modifiez la recherche ou les filtres."
                : "Les questions arrivent ici dès qu'un examen est enregistré avec un module."
            }
          />
        </div>
      ) : (
        <>
          <p className="-mb-3 text-sm text-muted">
            {result.truncated
              ? `${result.items.length} premières questions sur ${result.total} : affinez la recherche pour voir les autres.`
              : `${result.total} question${result.total > 1 ? "s" : ""}. Cochez-en pour créer un examen.`}
          </p>
          <BankList items={result.items} />
        </>
      )}
    </>
  );
}
