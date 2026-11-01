import "server-only";
import { serverEnv } from "@/server/env";

/** Service de correction configuré (clé présente). */
export const deepseekConfigured = () => !!serverEnv().DEEPSEEK_API_KEY;

/**
 * Appel JSON au service de correction. Renvoie le contenu texte de la réponse.
 * Une seconde tentative est faite sur erreur réseau / 5xx / délai dépassé.
 */
export async function deepseekJson(
  system: string,
  user: string,
  options: { timeoutMs?: number; maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const env = serverEnv();
  if (!env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY absente");
  const call = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? 45_000);
    try {
      const res = await fetch(`${env.DEEPSEEK_BASE_URL.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.DEEPSEEK_MODEL,
          temperature: options.temperature ?? 0.2,
          max_tokens: options.maxTokens ?? 1800,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`relecture HTTP ${res.status} ${body.slice(0, 160)}`);
      }
      const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      return json.choices?.[0]?.message?.content ?? "";
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    return await call();
  } catch (e) {
    if (e instanceof Error && e.message.startsWith("relecture HTTP 4")) throw e;
    return await call();
  }
}

/** Extrait le premier objet JSON d'une réponse. */
export function jsonObjectOf(content: string): Record<string, unknown> {
  const match = /\{[\s\S]*\}/.exec(content);
  if (!match) throw new Error("relecture : réponse illisible");
  return JSON.parse(match[0]) as Record<string, unknown>;
}

export const cleanText = (v: unknown, n: number) =>
  typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, n) : "";
