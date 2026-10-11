import { randomInt } from "node:crypto";

/** Sans caractères ambigus (0/O, 1/I) : le code est recopié depuis le tableau. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** Code d'accès à 6 caractères, ex. « K7M4Q2 ». */
export function generateAccessCode(length = 6): string {
  return Array.from({ length }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}
