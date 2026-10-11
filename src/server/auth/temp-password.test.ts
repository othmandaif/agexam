import { describe, expect, it } from "vitest";
import { generateTempPassword } from "./temp-password";

describe("generateTempPassword", () => {
  it("respecte le format et la complexité", () => {
    for (let i = 0; i < 200; i++) {
      const pwd = generateTempPassword();
      expect(pwd).toMatch(/^[A-Za-z2-9]{4}-[A-Za-z2-9]{4}-[A-Za-z2-9]{4}$/);
      expect(pwd).toMatch(/[a-z]/);
      expect(pwd).toMatch(/[A-Z]/);
      expect(pwd).toMatch(/\d/);
      expect(pwd).not.toMatch(/[01OlI]/);
    }
  });

  it("ne produit pas deux fois le même mot de passe", () => {
    const set = new Set(Array.from({ length: 500 }, generateTempPassword));
    expect(set.size).toBe(500);
  });
});
