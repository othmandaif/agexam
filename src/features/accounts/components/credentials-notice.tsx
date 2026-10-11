"use client";

import { Check, Copy, KeyRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CredentialsNoticeProps {
  fullName: string;
  email: string;
  tempPassword: string;
}

/** Identifiants affichés UNE seule fois : ils ne sont pas conservés en clair. */
export function CredentialsNotice({ fullName, email, tempPassword }: CredentialsNoticeProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(
      `AGExam\nNom : ${fullName}\nE-mail : ${email}\nMot de passe provisoire : ${tempPassword}`,
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-warning-fill/40 bg-warning-bg p-4">
      <div className="flex items-center gap-2 text-sm font-bold text-warning">
        <KeyRound className="size-4" aria-hidden />
        Notez ces identifiants maintenant : ils ne seront plus affichés.
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">E-mail</dt>
        <dd className="font-semibold break-all">{email}</dd>
        <dt className="text-muted">Mot de passe</dt>
        <dd className="font-mono text-base font-bold tracking-wider">{tempPassword}</dd>
      </dl>
      <p className="text-xs text-muted">
        L&apos;utilisateur devra choisir son propre mot de passe à la première connexion.
      </p>
      <Button size="sm" variant="outline" onClick={copy} className="self-start">
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? "Copié" : "Copier"}
      </Button>
    </div>
  );
}
