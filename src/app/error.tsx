"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="font-display text-2xl font-bold">Une erreur est survenue</h1>
      <p className="max-w-md text-muted">
        Réessayez. Si le problème continue, communiquez cette référence à votre formateur :{" "}
        <code className="font-mono text-ink">{error.digest ?? "—"}</code>
      </p>
      <Button variant="outline" onClick={reset}>
        Réessayer
      </Button>
    </main>
  );
}
