import { describe, expect, it } from "vitest";
import { academicYearOf, isAcademicYear } from "./academic-year";

describe("année scolaire", () => {
  it("commence le 1er septembre (heure du Maroc)", () => {
    expect(academicYearOf(new Date("2026-08-31T22:59:00Z"))).toBe("2025-2026"); // 23:59 Casablanca
    expect(academicYearOf(new Date("2026-08-31T23:30:00Z"))).toBe("2026-2027"); // 00:30 le 1er sept.
    expect(academicYearOf(new Date("2026-10-11T10:00:00Z"))).toBe("2026-2027");
    expect(academicYearOf(new Date("2027-06-30T10:00:00Z"))).toBe("2026-2027");
  });
  it("valide le format", () => {
    expect(isAcademicYear("2026-2027")).toBe(true);
    expect(isAcademicYear("2026-2028")).toBe(false);
    expect(isAcademicYear("2026")).toBe(false);
    expect(isAcademicYear(null)).toBe(false);
  });
});
