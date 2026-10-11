import { AppShell } from "@/components/layout/app-shell";
import { requireTenant } from "@/server/auth/session";

export default async function TrainerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  return (
    <AppShell role={user.role} fullName={user.fullName} establishmentId={user.establishmentId}>
      {children}
    </AppShell>
  );
}
