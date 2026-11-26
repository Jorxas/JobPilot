// Gemeinsame Anbieterwahl für Indeed: je manuellem Suchstart genau ein Connector (ChatGPT/Codex oder Claude).
// Öffentliche Fassung: Claude auch bei ausdrücklicher Wahl nur mit Freigabe (JOBPILOT_INDEED_CLAUDE=1); Codex prüft
// seine Freigabe (JOBPILOT_INDEED_CODEX=1) selbst, bevor ein Prozess startet.
import { scanIndeedViaCodex, type IndeedCodexScan } from "./indeed-codex";
import { scanIndeedViaClaude, indeedViaClaudeVerfuegbar } from "./indeed-claude";
import { platformSearchUrl } from "./platforms";

export type IndeedProvider = "auto" | "codex" | "claude";
export const INDEED_PROVIDERS: IndeedProvider[] = ["auto", "codex", "claude"];

function claudeNichtFreigeschaltet(keywords: string[], city: string, radiusKm: number): IndeedCodexScan {
  const terms = [...new Set(keywords.map(k => k.trim()).filter(Boolean))].slice(0, 5);
  return { offers: [], unavailable: true, report: { source: "indeed", status: "error", found: 0, inserted: 0, limited: true, keywords: terms.join(" · "), searchUrl: platformSearchUrl("indeed", terms[0] || "", city, radiusKm), message: "Indeed über Claude ist nicht freigeschaltet (JOBPILOT_INDEED_CLAUDE=1 und Claude Code erforderlich); keine Anfrage ausgeführt." } };
}

// Nur vor jeder gesendeten Suche ausweichen. Eine unsichere oder fehlgeschlagene Suche nie mit einem anderen Konto
// oder Anbieter wiederholen.
export async function scanIndeedViaConnector(keywords: string[], city: string, radiusKm: number, provider: IndeedProvider = "auto", deps = { codex: scanIndeedViaCodex, claude: scanIndeedViaClaude, claudeAvailable: indeedViaClaudeVerfuegbar }): Promise<IndeedCodexScan> {
  const chosen = provider === "auto" ? process.env.JOBPILOT_INDEED_PROVIDER || "auto" : provider;
  if (!["auto", "codex", "claude"].includes(chosen)) throw new Error("Unbekannter Indeed-Suchassistent.");
  if (chosen === "claude") return deps.claudeAvailable() ? deps.claude(keywords, city, radiusKm) : claudeNichtFreigeschaltet(keywords, city, radiusKm);
  const result = await deps.codex(keywords, city, radiusKm);
  if (chosen === "auto" && result.unavailable && deps.claudeAvailable()) {
    const fallback = await deps.claude(keywords, city, radiusKm);
    fallback.report.message = "ChatGPT/Codex vor jeder Suchanfrage nicht verfügbar; Claude verwendet. " + fallback.report.message;
    return fallback;
  }
  return result;
}
