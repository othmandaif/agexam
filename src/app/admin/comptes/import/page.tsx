import { Upload } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { ImportWizard } from "@/features/accounts/components/import-wizard";
import { listGroupOptions } from "@/features/accounts/server/queries";
import { ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";

export const metadata: Metadata = { title: "Importer des étudiants" };

export default async function ImportStudentsPage() {
  const user = await requireTenant("ADMIN");
  const groups = await listGroupOptions(user.establishmentId);
  return (
    <>
      <PageHeader
        icon={<Upload aria-hidden />}
        back={{ href: ROUTES.admin.accounts, label: "Comptes" }}
        title="Importer des étudiants"
        description="Création des comptes et des groupes depuis un fichier Excel."
      />
      <ImportWizard groups={groups} requireGroup={false} />
    </>
  );
}
