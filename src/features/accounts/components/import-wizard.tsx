"use client";

import { Download, FileSpreadsheet, Printer, RotateCcw, Upload } from "lucide-react";
import { useActionState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormMessage, SubmitButton } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Table, Td, Th } from "@/components/ui/table";
import { IDLE, type ActionState } from "@/lib/action-state";
import { previewImportAction, runImportAction } from "../import/actions";
import type { ImportPreview, ImportResult, RowStatus } from "../import/server";

const STATUS: Record<
  RowStatus,
  { label: string; tone: "success" | "neutral" | "danger" | "info" }
> = {
  create: { label: "À créer", tone: "success" },
  reactivate: { label: "Réinscrit (année passée)", tone: "info" },
  exists: { label: "Existe déjà", tone: "neutral" },
  error: { label: "Erreur", tone: "danger" },
};

/** CSV au format Excel français (point-virgule, BOM UTF-8). */
function downloadCredentials(result: ImportResult) {
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [
    ["Nom complet", "E-mail", "Groupe", "Mot de passe provisoire"].map(escape).join(";"),
    ...result.created.map((r) =>
      [r.fullName, r.email, r.groupName ?? "", r.tempPassword].map(escape).join(";"),
    ),
  ];
  const blob = new Blob(["﻿" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `identifiants-etudiants-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ImportWizard({
  groups,
  requireGroup,
  defaultGroupId,
}: {
  /** Groupes de l'année courante. */
  groups: { id: string; name: string }[];
  /** Formateur : groupe cible obligatoire, colonne Groupe du fichier ignorée. */
  requireGroup: boolean;
  defaultGroupId?: string | null;
}) {
  const [preview, previewAction] = useActionState<ActionState<ImportPreview>, FormData>(
    previewImportAction,
    IDLE,
  );
  const [result, runAction] = useActionState<ActionState<ImportResult>, FormData>(
    runImportAction,
    IDLE,
  );
  // Étape 3 : résultats
  if (result.status === "success" && result.data) {
    const data = result.data;
    return (
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Import terminé</CardTitle>
          <CardDescription>
            {data.created.length} étudiant{data.created.length > 1 ? "s inscrits" : " inscrit"}
            {data.failed.length > 0 ? ` · ${data.failed.length} échec(s)` : ""}. Téléchargez ou
            imprimez les identifiants maintenant : les mots de passe ne seront plus affichés.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 print:hidden">
          <Button variant="mint" onClick={() => downloadCredentials(data)}>
            <Download aria-hidden /> Télécharger les identifiants (CSV)
          </Button>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer aria-hidden /> Imprimer
          </Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>
            <RotateCcw aria-hidden /> Nouvel import
          </Button>
        </CardContent>
        {data.failed.length > 0 ? (
          <div className="px-6 pb-4">
            <p className="mb-2 text-sm font-bold text-danger">Lignes non importées</p>
            <ul className="text-sm text-danger">
              {data.failed.map((f) => (
                <li key={f.line}>
                  Ligne {f.line} ({f.email}) : {f.reason}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <Table>
          <thead>
            <tr>
              <Th>Nom complet</Th>
              <Th>E-mail</Th>
              <Th>Groupe</Th>
              <Th>Mot de passe provisoire</Th>
            </tr>
          </thead>
          <tbody>
            {data.created.map((r) => (
              <tr key={r.email}>
                <Td className="font-semibold">{r.fullName}</Td>
                <Td>{r.email}</Td>
                <Td>{r.groupName ?? "—"}</Td>
                <Td className="font-mono font-bold tracking-wider">{r.tempPassword}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    );
  }

  // Étape 2 : aperçu
  if (preview.status === "success" && preview.data) {
    const { rows, summary, fileName, targetGroup } = preview.data;
    const toCreate = rows.filter((r) => r.status === "create" || r.status === "reactivate");
    return (
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>Aperçu de « {fileName} »</CardTitle>
          <CardDescription>Rien n&apos;est encore créé. Vérifiez puis confirmez.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-2">
            {targetGroup ? <Badge tone="info">Groupe : {targetGroup.name}</Badge> : null}
            <Badge tone="success">{summary.create} à créer</Badge>
            {summary.reactivate > 0 ? (
              <Badge tone="info">{summary.reactivate} réinscrit(s) d&apos;une année passée</Badge>
            ) : null}
            {summary.exists > 0 ? (
              <Badge tone="neutral">{summary.exists} déjà existants</Badge>
            ) : null}
            {summary.error > 0 ? <Badge tone="danger">{summary.error} en erreur</Badge> : null}
            {summary.newGroups.length > 0 ? (
              <Badge tone="info">Nouveaux groupes : {summary.newGroups.join(", ")}</Badge>
            ) : null}
          </div>
          <FormMessage state={result} />
          <form action={runAction} className="flex flex-wrap gap-3">
            <input type="hidden" name="rows" value={JSON.stringify(toCreate)} />
            {targetGroup ? <input type="hidden" name="groupId" value={targetGroup.id} /> : null}
            <SubmitButton
              variant="mint"
              disabled={toCreate.length === 0}
              pendingLabel="Création des comptes… (ne fermez pas la page)"
            >
              Inscrire {toCreate.length} étudiant{toCreate.length > 1 ? "s" : ""}
            </SubmitButton>
            <Button variant="ghost" onClick={() => window.location.reload()}>
              Choisir un autre fichier
            </Button>
          </form>
          {summary.error > 0 ? (
            <p className="text-sm text-muted">
              Les lignes en erreur sont ignorées. Corrigez le fichier et relancez l&apos;import pour
              les ajouter.
            </p>
          ) : null}
        </CardContent>
        <Table>
          <thead>
            <tr>
              <Th>Ligne</Th>
              <Th>Nom complet</Th>
              <Th>E-mail</Th>
              <Th>Groupe</Th>
              <Th>Statut</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.line} className={r.status === "error" ? "bg-danger-bg/40" : undefined}>
                <Td className="text-muted">{r.line}</Td>
                <Td className="font-semibold">{r.fullName || "—"}</Td>
                <Td>{r.email || "—"}</Td>
                <Td>
                  {r.groupName ?? "—"}
                  {r.newGroup ? (
                    <Badge tone="info" className="ml-2">
                      nouveau
                    </Badge>
                  ) : null}
                </Td>
                <Td>
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                  {r.errors.length > 0 ? (
                    <span className="mt-1 block text-xs whitespace-normal text-danger">
                      {r.errors.join(" ")}
                    </span>
                  ) : null}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    );
  }

  // Étape 1 : choix du fichier
  return (
    <Card>
      <CardHeader>
        <CardTitle>1. Préparer le fichier</CardTitle>
        <CardDescription>
          {requireGroup ? (
            <>
              Colonnes : <strong>Nom complet</strong>, <strong>E-mail</strong>. Tous les étudiants
              du fichier sont inscrits dans le groupe choisi ci-dessous. 300 lignes maximum.
            </>
          ) : (
            <>
              Colonnes : <strong>Nom complet</strong>, <strong>E-mail</strong>,{" "}
              <strong>Groupe</strong> (facultatif). Un groupe inconnu est créé pour l&apos;année en
              cours. 300 lignes maximum.
            </>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <a
          href="/api/v1/imports/students/template"
          className={buttonVariants({ variant: "outline", className: "self-start" })}
          download
        >
          <FileSpreadsheet aria-hidden /> Télécharger le modèle Excel
        </a>
        <form action={previewAction} className="flex flex-col gap-3">
          <FormMessage state={preview} />
          {requireGroup && groups.length === 0 ? (
            <p className="rounded-field bg-warning-bg px-4 py-3 text-sm text-warning">
              Aucun groupe pour l&apos;année en cours. Demandez à l&apos;administration de créer le
              groupe, puis revenez importer les étudiants.
            </p>
          ) : null}
          <Label htmlFor="import-group">
            {requireGroup ? "Groupe" : "Groupe (facultatif)"}
            {requireGroup ? <span className="text-danger"> *</span> : null}
          </Label>
          <div className="max-w-sm">
            <Select
              id="import-group"
              name="groupId"
              defaultValue={defaultGroupId ?? ""}
              required={requireGroup}
            >
              <option value="">
                {requireGroup ? "Choisir un groupe…" : "Selon la colonne Groupe du fichier"}
              </option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Select>
          </div>
          <Label htmlFor="import-file">Fichier rempli (.xlsx ou .csv)</Label>
          <input
            id="import-file"
            name="file"
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            required
            className="rounded-field border border-dashed border-line bg-canvas p-4 text-sm file:mr-4 file:rounded-full file:border-0 file:bg-lilac file:px-4 file:py-2 file:font-bold file:text-primary-strong"
          />
          <SubmitButton className="self-start" pendingLabel="Analyse du fichier…">
            <Upload aria-hidden /> Analyser le fichier
          </SubmitButton>
        </form>
      </CardContent>
    </Card>
  );
}
