import { Upload } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ImportWizard } from "@/features/accounts/components/import-wizard";
import { listGroupOptions } from "@/features/accounts/server/queries";
import { ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";

export const metadata: Metadata = { title: "Importer des étudiants" };

export default async function TrainerImportStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ groupe?: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const [{ groupe }, groups] = await Promise.all([
    searchParams,
    listGroupOptions(user.establishmentId),
  ]);
  return (
    <>
      <PageHeader
        icon={<Upload aria-hidden />}
        back={{ href: ROUTES.trainer.students, label: "Étudiants" }}
        title="Importer des étudiants"
        description={
          user.role === "ADMIN"
            ? "Création des comptes (et des groupes manquants) depuis le modèle Excel rempli."
            : "Choisissez le groupe, puis le modèle Excel rempli : les étudiants y sont inscrits."
        }
      />
      <ImportWizard
        groups={groups}
        requireGroup={user.role !== "ADMIN"}
        defaultGroupId={groups.some((g) => g.id === groupe) ? groupe : null}
      />
    </>
  );
}
