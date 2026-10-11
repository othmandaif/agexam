import { Hourglass } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { homePathFor } from "@/lib/routes";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Compte en attente" };

export default async function PendingAccountPage() {
  const user = await requireUser();
  if (user.establishmentId) redirect(homePathFor(user.role));

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="flex size-14 items-center justify-center rounded-full bg-warning-bg text-warning">
        <Hourglass className="size-6" aria-hidden />
      </span>
      <h1 className="font-display text-2xl font-bold">Compte en attente</h1>
      <p className="text-sm text-muted">
        Votre compte n&apos;est rattaché à aucun établissement. Contactez l&apos;administrateur de
        votre établissement.
      </p>
      <SignOutButton />
    </div>
  );
}
