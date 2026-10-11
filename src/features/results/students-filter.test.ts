import { describe, expect, it } from "vitest";
import { filterStudents } from "./students-filter";
import type { ResultStudent } from "./types";

const s = (fullName: string, score: number | null, extra: Partial<ResultStudent> = {}) =>
  ({
    profileId: fullName,
    fullName,
    email: `${fullName}@x.ma`,
    groups: "DEV101",
    status: score === null ? "ABSENT" : "SOUMISE",
    scoreOutOf20: score,
    flagged: false,
    rank: null,
    ...extra,
  }) as ResultStudent;

describe("filterStudents", () => {
  const list = [
    s("Basma", 8, { rank: 2 }),
    s("Amine", 15, { rank: 1 }),
    s("Chaima", null),
    s("Driss", 12, { rank: 3, flagged: true }),
  ];
  it("trie par rang puis nom", () => {
    expect(filterStudents(list, {}).map((x) => x.fullName)).toEqual([
      "Amine",
      "Basma",
      "Driss",
      "Chaima",
    ]);
  });
  it("filtre par statut et recherche", () => {
    expect(filterStudents(list, { statut: "failed" }).map((x) => x.fullName)).toEqual(["Basma"]);
    expect(filterStudents(list, { statut: "absent" }).map((x) => x.fullName)).toEqual(["Chaima"]);
    expect(filterStudents(list, { statut: "review" }).map((x) => x.fullName)).toEqual(["Driss"]);
    expect(filterStudents(list, { q: "AMI" }).map((x) => x.fullName)).toEqual(["Amine"]);
  });
});
