import "server-only";
import { createHash } from "node:crypto";
import { canonicalQuestion, type FingerprintInput } from "@/domain/question-fingerprint";

/** Empreinte d'une question (md5 hexadécimal du texte canonique). */
export function questionFingerprint(q: FingerprintInput): string {
  return createHash("md5").update(canonicalQuestion(q), "utf8").digest("hex");
}
