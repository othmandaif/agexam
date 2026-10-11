import "server-only";
import type { Database } from "@/server/db/client";
import { auditLogs } from "@/server/db/schema";

type Executor = Pick<Database, "insert">;

export interface AuditEntry {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  payload?: Record<string, unknown>;
}

/** Trace une action sensible. Passer la transaction en cours si elle existe. */
export async function audit(db: Executor, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values(entry);
}
