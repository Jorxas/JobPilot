import { scanIndeedViaCodex, type IndeedCodexScan } from "./indeed-codex";
import { scanIndeedViaClaude, indeedViaClaudeVerfuegbar } from "./indeed-claude";
import { scanIndeedViaJobspy } from "./indeed-ts-jobspy";
import { normalize, type Offer } from "./core";
import { platformSearchUrl } from "./platforms";

export type IndeedProvider = "auto" | "codex" | "claude";
export const INDEED_PROVIDERS: IndeedProvider[] = ["auto", "codex", "claude"];
type Leser = (begriffe: string[], stadt: string, radius: number) => Promise<IndeedCodexScan>;
type Dienste = { primaer?: Leser; codex: Leser; claude: Leser; claudeAvailable: () => boolean };

// Die Anbieterwahl bestimmt den bevorzugten offiziellen Ersatz. Der kostenlose Extraktor bleibt zuerst.
// Nur fehlgeschlagene oder unbestätigte Begriffe wechseln den Weg, niemals bereits erfolgreiche leere Suchen.
export async function scanIndeedViaConnector(keywords: string[], city: string, radiusKm: number, provider: IndeedProvider = "auto",
  deps: Dienste = { primaer: scanIndeedViaJobspy, codex: scanIndeedViaCodex, claude: scanIndeedViaClaude, claudeAvailable: indeedViaClaudeVerfuegbar }): Promise<IndeedCodexScan> {
  const gewaehlt = provider === "auto" ? process.env.JOBPILOT_INDEED_PROVIDER || "auto" : provider;
  if (!INDEED_PROVIDERS.includes(gewaehlt as IndeedProvider)) throw Error("Unbekannter Indeed-Suchassistent.");
  const begriffe = [...new Set(keywords.map(k => k.trim()).filter(Boolean))].slice(0, 5);
  if (!begriffe.length || begriffe.some(b => b.length > 300) || !city.trim() || city.length > 300 || !Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 200) throw Error("Ungültige Indeed-Suchkriterien.");
  const wege: [string, Leser][] = [["ts-jobspy", deps.primaer || scanIndeedViaJobspy]];
  const codex: [string, Leser] = ["ChatGPT/Codex", deps.codex], claude: [string, Leser] = ["Claude", deps.claude];
  wege.push(...(gewaehlt === "claude" ? [claude, codex] : [codex, claude]));
  const angebote = new Map<string, Offer>(), meldungen: string[] = [], bestaetigt = new Set<string>();
  let offen = begriffe;
  for (const [name, lesen] of wege) {
    if (!offen.length) break;
    if (name === "Claude" && !deps.claudeAvailable()) { meldungen.push("Claude nicht verfügbar oder nicht freigeschaltet."); continue; }
    try {
      const r = await lesen(offen, city, radiusKm);
      meldungen.push(r.report.message);
      for (const o of r.offers) {
        // Bundesland-/Ländersuffixe unterscheiden sich zwischen den drei Werkzeugen.
        const schluessel = [o.company || "", o.title, (o.location || "").split(",")[0]].map(normalize).join("|");
        const vorher = angebote.get(schluessel);
        if (!vorher || o.description.length > vorher.description.length) angebote.set(schluessel, o);
      }
      const erledigt = r.completedKeywords || (r.report.status !== "error" && !r.unavailable && !r.remainingKeywords ? offen : []);
      for (const b of erledigt) if (offen.includes(b)) bestaetigt.add(b);
      offen = offen.filter(b => !bestaetigt.has(b));
    } catch {
      meldungen.push(`${name} fehlgeschlagen; keine bestätigte Antwort.`);
    }
  }
  return { offers: [...angebote.values()], completedKeywords: [...bestaetigt], remainingKeywords: offen,
    report: { source: "indeed", status: bestaetigt.size || angebote.size ? "partial" : "error", found: angebote.size, inserted: 0, limited: true,
      keywords: begriffe.join(" · "), searchUrl: platformSearchUrl("indeed", begriffe[0], city, radiusKm),
      message: `${bestaetigt.size}/${begriffe.length} Indeed-Suchen bestätigt. ${offen.length ? `${offen.length} nicht abgeschlossen; ` : ""}Teilabruf. ${meldungen.join(" ")}` } };
}
