import { Database, FileText, Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ExamPhaseBadge } from "@/components/exam/exam-phase-badge";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { examPhase } from "@/domain/exam-lifecycle";
import { parseBankFilters } from "@/features/bank/schemas";
import { listBankQuestions } from "@/features/bank/server/queries";
import { listExams } from "@/features/exams/server/queries";
import { listGroups } from "@/features/groups/server/queries";
import { formatWindow } from "@/lib/datetime";
import { paths } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { getViewYear } from "@/server/year";

export const metadata: Metadata = { title: "Recherche" };

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Recherche globale (barre du haut) : examens, questions, groupes. */
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const year = await getViewYear();
  const q = ((await searchParams).q ?? "").trim().slice(0, 120);
  const term = norm(q);
  const now = new Date();

  const [exams, groups, questions] = q
    ? await Promise.all([
        listExams(user, year),
        listGroups(user.establishmentId, year),
        listBankQuestions(user, parseBankFilters({ q }), 8),
      ])
    : [[], [], { items: [], total: 0, truncated: false }];
  const examHits = exams.filter((e) => norm(e.title).includes(term)).slice(0, 8);
  const groupHits = groups
    .filter((g) => norm(g.name).includes(term) || norm(g.label ?? "").includes(term))
    .slice(0, 8);
  const total = examHits.length + groupHits.length + questions.items.length;

  return (
    <>
      <PageHeader
        icon={<Search />}
        title={q ? `Résultats pour « ${q} »` : "Recherche"}
        description={
          q
            ? `${total} résultat${total > 1 ? "s" : ""}`
            : "Tapez un mot dans la barre de recherche (Ctrl + K)."
        }
      />
      {q && total === 0 ? (
        <Card>
          <EmptyState
            icon={Search}
            title="Aucun résultat"
            description="Vérifiez l'orthographe ou essayez un mot plus court (titre d'examen, nom de groupe, mot de l'énoncé)."
          />
        </Card>
      ) : null}
      {examHits.length > 0 ? (
        <Section icon={<FileText />} title="Examens">
          {examHits.map((e) => (
            <Row
              key={e.id}
              href={paths.exam(e.id)}
              title={e.title}
              sub={formatWindow(e.opensAt, e.closesAt)}
            >
              <ExamPhaseBadge phase={examPhase(e, now)} />
            </Row>
          ))}
        </Section>
      ) : null}
      {questions.items.length > 0 ? (
        <Section
          icon={<Database />}
          title={`Questions${questions.truncated ? ` (${questions.total})` : ""}`}
        >
          {questions.items.map((qq) => (
            <Row
              key={qq.id}
              href={paths.bankQuestion(qq.id)}
              title={qq.prompt}
              sub={qq.moduleCode}
            />
          ))}
        </Section>
      ) : null}
      {groupHits.length > 0 ? (
        <Section icon={<Users />} title="Groupes">
          {groupHits.map((g) => (
            <Row
              key={g.id}
              href={paths.group(g.id)}
              title={g.name}
              sub={`${g.memberCount} étudiant${g.memberCount > 1 ? "s" : ""}${g.label ? ` · ${g.label}` : ""}`}
            />
          ))}
        </Section>
      ) : null}
    </>
  );
}

function Section({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <h2 className="flex items-center gap-2.5 px-6 pt-5 pb-3 text-[17px] font-bold [&_svg]:size-5 [&_svg]:text-primary">
        {icon}
        {title}
      </h2>
      <ul className="border-t border-line-soft">{children}</ul>
    </Card>
  );
}

function Row({
  href,
  title,
  sub,
  children,
}: {
  href: Parameters<typeof Link>[0]["href"];
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="border-b border-line-soft last:border-0">
      <Link
        href={href}
        className="flex items-center gap-4 px-6 py-3.5 text-ink no-underline hover:bg-[#f8fafc]"
      >
        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 font-semibold">{title}</span>
          {sub ? <span className="block text-[13px] text-muted">{sub}</span> : null}
        </span>
        {children}
      </Link>
    </li>
  );
}
