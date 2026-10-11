import { describe, expect, it } from "vitest";
import {
  groupCopies,
  participationRate,
  periodStart,
  studentProgress,
  summarizeCopies,
  type GradedCopy,
} from "./analytics";

const c = (
  studentId: string,
  examId: string,
  examAt: number,
  score: number,
  groupIds: string[] = ["g1"],
  moduleId: string | null = "m1",
): GradedCopy => ({ studentId, examId, examAt, score, groupIds, moduleId });

describe("groupCopies", () => {
  it("une copie compte dans chacun de ses groupes, les clés nulles sont ignorées", () => {
    const copies = [c("s1", "e1", 1, 12, ["g1", "g2"]), c("s2", "e1", 1, 8, ["g2"], null)];
    const byGroup = groupCopies(copies, (x) => x.groupIds);
    expect(byGroup.get("g1")).toHaveLength(1);
    expect(byGroup.get("g2")).toHaveLength(2);
    const byModule = groupCopies(copies, (x) => [x.moduleId]);
    expect([...byModule.keys()]).toEqual(["m1"]);
    expect(summarizeCopies(byGroup.get("g2")!).mean).toBe(10);
  });
});

describe("studentProgress", () => {
  const copies = [
    c("up", "e2", 200, 15),
    c("up", "e1", 100, 9),
    c("down", "e1", 100, 16),
    c("down", "e2", 200, 15),
    c("down", "e3", 300, 10),
    c("low", "e1", 100, 8),
    c("flat", "e1", 100, 12),
    c("flat", "e2", 200, 13),
  ];
  const byId = Object.fromEntries(studentProgress(copies).map((p) => [p.studentId, p]));

  it("ordonne l'historique et calcule moyenne, dernière note, écart", () => {
    expect(byId.up!.history.map((h) => h.score)).toEqual([9, 15]);
    expect(byId.up!.mean).toBe(12);
    expect(byId.up!.last).toBe(15);
    expect(byId.up!.delta).toBe(6);
    expect(byId.up!.trend).toBe("IMPROVING");
  });

  it("baisse nette : à suivre même avec une bonne moyenne", () => {
    expect(byId.down!.delta).toBe(-5.5);
    expect(byId.down!.trend).toBe("DECLINING");
    expect(byId.down!.atRisk).toBe(true);
  });

  it("une seule note : pas de tendance ; sous 10 : à suivre", () => {
    expect(byId.low!.trend).toBeNull();
    expect(byId.low!.delta).toBeNull();
    expect(byId.low!.atRisk).toBe(true);
    expect(byId.flat!.trend).toBe("STABLE");
    expect(byId.flat!.atRisk).toBe(false);
  });
});

describe("participationRate", () => {
  it("borne à 100 % et gère zéro inscrit", () => {
    expect(participationRate(18, 20)).toBe(0.9);
    expect(participationRate(5, 4)).toBe(1);
    expect(participationRate(0, 0)).toBeNull();
  });
});

describe("periodStart", () => {
  it("année de formation à partir du 1er septembre", () => {
    expect(periodStart("annee", new Date("2026-10-08T10:00:00Z"))?.toISOString()).toBe(
      "2026-09-01T00:00:00.000Z",
    );
    expect(periodStart("annee", new Date("2027-03-15T10:00:00Z"))?.toISOString()).toBe(
      "2026-09-01T00:00:00.000Z",
    );
  });
  it("périodes glissantes et « tout »", () => {
    const now = new Date("2026-10-08T00:00:00Z");
    expect(periodStart("30j", now)?.toISOString()).toBe("2026-09-08T00:00:00.000Z");
    expect(periodStart("tout", now)).toBeNull();
  });
});
