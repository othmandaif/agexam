import type { Metadata } from "next";
import { GroupsBoard } from "@/features/groups/components/groups-board";
import { listGroups } from "@/features/groups/server/queries";
import { requireTenant } from "@/server/auth/session";
import { getViewYear } from "@/server/year";
import { currentAcademicYear } from "@/domain/academic-year";

export const metadata: Metadata = { title: "Groupes" };

export default async function GroupsPage() {
  const user = await requireTenant("FORMATEUR", "ADMIN");
  const year = await getViewYear();
  return (
    <GroupsBoard
      groups={await listGroups(user.establishmentId, year)}
      canManage={user.role === "ADMIN" && year === currentAcademicYear()}
    />
  );
}
