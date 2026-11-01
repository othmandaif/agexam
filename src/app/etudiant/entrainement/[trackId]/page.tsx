import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { BackLink } from "@/components/navigation/back-link";
import { DoorMap } from "@/features/training/components/door-map";
import { GameHeader } from "@/features/training/components/game-header";
import { getStudentTrack } from "@/features/training/server/queries";
import { ROUTES } from "@/lib/routes";
import { requireTenant } from "@/server/auth/session";
import { AppError } from "@/server/http/errors";

export const metadata: Metadata = { title: "Parcours" };

export default async function StudentTrackPage({
  params,
}: {
  params: Promise<{ trackId: string }>;
}) {
  const user = await requireTenant("ETUDIANT");
  const { trackId } = await params;
  if (!z.uuid().safeParse(trackId).success) notFound();
  const { track, levels, solvedCount, total, xp, maxXp, badges } = await getStudentTrack(
    user.id,
    user.establishmentId,
    trackId,
  ).catch((e) => {
    if (e instanceof AppError) notFound();
    throw e;
  });

  return (
    <>
      <div className="flex flex-col gap-3">
        <BackLink href={ROUTES.student.training}>Entraînement</BackLink>
        <h1 className="text-[28px] leading-tight font-bold">{track.title}</h1>
        {track.description ? <p className="text-[15px] text-muted">{track.description}</p> : null}
      </div>

      <GameHeader xp={xp} maxXp={maxXp} solved={solvedCount} total={total} badges={badges} />

      <DoorMap levels={levels} />
    </>
  );
}
