"use client";

import { ArrowRight, Eye, EyeOff, Info, Lock, Mail } from "lucide-react";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signInAction } from "../actions";
import type { SignInState } from "../schemas";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<SignInState, FormData>(signInAction, {});
  const [showPassword, setShowPassword] = useState(false);
  const [forgot, setForgot] = useState(false);

  return (
    <form action={formAction} className="flex w-full max-w-[440px] flex-col gap-6" noValidate>
      <div>
        <h1 className="mb-2 text-[30px] leading-tight font-bold">Bienvenue sur AGExam</h1>
        <p className="text-[15px] text-muted">
          Connectez-vous avec le compte fourni par votre établissement.
        </p>
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-[12px] bg-danger-bg px-4 py-3 text-sm font-semibold text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Adresse e-mail</Label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-faint" />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="ex. s.benali@etab.ma"
            defaultValue={state.email}
            className="h-12 pl-10"
            aria-invalid={state.fieldErrors?.email ? true : undefined}
            aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
            required
          />
        </div>
        {state.fieldErrors?.email ? (
          <p id="email-error" className="text-sm text-danger">
            {state.fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Mot de passe</Label>
          <button
            type="button"
            onClick={() => setForgot((v) => !v)}
            className="text-[13px] font-semibold text-primary hover:underline"
            aria-expanded={forgot}
          >
            Mot de passe oublié ?
          </button>
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute top-1/2 left-3.5 size-[18px] -translate-y-1/2 text-faint" />
          <Input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Votre mot de passe"
            className="h-12 pr-11 pl-10"
            aria-invalid={state.fieldErrors?.password ? true : undefined}
            aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
            className="absolute top-1/2 right-2 flex size-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-faint hover:bg-canvas hover:text-ink"
          >
            {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
          </button>
        </div>
        {state.fieldErrors?.password ? (
          <p id="password-error" className="text-sm text-danger">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
        {forgot ? (
          <p className="animate-fade-in rounded-[10px] bg-primary-wash px-3.5 py-2.5 text-[13px] text-ink-soft">
            Les comptes sont gérés par votre établissement : demandez à l&apos;administrateur AGExam
            de réinitialiser votre mot de passe. Vous recevrez un mot de passe provisoire.
          </p>
        ) : null}
      </div>

      {next ? <input type="hidden" name="next" value={next} /> : null}

      <Button type="submit" size="lg" disabled={pending} className="h-[52px] w-full text-[16px]">
        {pending ? "Connexion…" : "Se connecter"}
        {!pending ? <ArrowRight aria-hidden /> : null}
      </Button>

      <div className="flex items-start gap-3 rounded-[12px] bg-canvas p-4 text-[13px] leading-relaxed text-muted">
        <Info className="mt-0.5 size-[18px] shrink-0 text-primary" aria-hidden />
        <span>
          Les examens se passent uniquement sur ordinateur, avec un navigateur récent (Chrome, Edge
          ou Firefox).
        </span>
      </div>
    </form>
  );
}
