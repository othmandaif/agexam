import type { Metadata } from "next";
import { ChangePasswordForm } from "@/features/accounts/components/change-password-form";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Mot de passe" };

export default async function ChangePasswordPage() {
  const user = await requireUser();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="mb-2 font-display text-2xl font-bold">
          {user.mustChangePassword ? "Choisissez votre mot de passe" : "Changer de mot de passe"}
        </h1>
        <p className="text-sm text-muted">
          {user.mustChangePassword
            ? `Bonjour ${user.fullName.split(" ")[0]}, vous utilisez un mot de passe provisoire. Remplacez-le pour continuer.`
            : "Saisissez votre nouveau mot de passe."}
        </p>
      </div>
      <ChangePasswordForm />
    </div>
  );
}
