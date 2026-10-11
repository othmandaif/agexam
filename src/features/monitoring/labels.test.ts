import { describe, expect, it } from "vitest";
import { formatAgo, formatRemaining } from "./labels";

const now = "2026-10-07T10:00:00.000Z";

describe("formatAgo", () => {
  it("formate secondes, minutes, heures", () => {
    expect(formatAgo("2026-10-07T09:59:48.000Z", now)).toBe("12 s");
    expect(formatAgo("2026-10-07T09:57:00.000Z", now)).toBe("3 min");
    expect(formatAgo("2026-10-07T08:55:00.000Z", now)).toBe("1 h 05");
    expect(formatAgo(null, now)).toBe("—");
  });
  it("ne renvoie jamais un temps négatif", () => {
    expect(formatAgo("2026-10-07T10:00:05.000Z", now)).toBe("0 s");
  });
});

describe("formatRemaining", () => {
  it("formate et borne à zéro", () => {
    expect(formatRemaining("2026-10-07T10:00:42.000Z", now)).toBe("0:42");
    expect(formatRemaining("2026-10-07T10:02:05.000Z", now)).toBe("2:05");
    expect(formatRemaining("2026-10-07T09:59:00.000Z", now)).toBe("0:00");
    expect(formatRemaining(null, now)).toBeNull();
  });
});
