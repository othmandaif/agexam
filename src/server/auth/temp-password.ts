import { randomInt } from "node:crypto";

/** Sans caractères ambigus (0/O, 1/l/I) : le mot de passe est souvent recopié à la main. */
const LOWER = "abcdefghijkmnpqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const ALL = LOWER + UPPER + DIGITS;

function pick(alphabet: string): string {
  return alphabet[randomInt(alphabet.length)]!;
}

/**
 * Mot de passe provisoire lisible, ex. « Kq7m-Tz4p-Hw9x ».
 * Contient toujours une minuscule, une majuscule et un chiffre.
 */
export function generateTempPassword(): string {
  for (;;) {
    const chars = Array.from({ length: 12 }, () => pick(ALL)).join("");
    if (/[a-z]/.test(chars) && /[A-Z]/.test(chars) && /\d/.test(chars)) {
      return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8)}`;
    }
  }
}
