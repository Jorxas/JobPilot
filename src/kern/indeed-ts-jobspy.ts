import { spawn } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { codexIndeedErgebnis, type IndeedCodexScan } from "./indeed-codex";
import { type Offer, type SourceReport } from "./core";
import { platformSearchUrl } from "./platforms";

type Zustand = { cache: Map<string, { bis: number; offers: Offer[] }>; gesperrtBis: number };
const speicher = globalThis as typeof globalThis & { jobpilotIndeedPrimaer?: Zustand };
const zustand = speicher.jobpilotIndeedPrimaer ||= { cache: new Map(), gesperrtBis: 0 };
export const neuerIndeedSpeicher = (): Zustand => ({ cache: new Map(), gesperrtBis: 0 });

export function jobspyUmgebung(env = process.env): NodeJS.ProcessEnv {
  // Der freie Extraktor braucht weder Zugangsdaten noch Proxy- oder Node-Startoptionen.
  return { ...Object.fromEntries(Object.entries(env).filter(([k]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|LANG|LC_ALL)$/i.test(k))), NODE_ENV: "production" };
}
export function jobspyLauf(begriff: string, stadt: string, radius: number, zeitlimit = 30000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const kind = spawn(process.execPath, ["--max-old-space-size=192", join(process.cwd(), "werkzeuge/indeed-ts-jobspy-worker.cjs")],
      { cwd: tmpdir(), env: jobspyUmgebung(), windowsHide: true, shell: false });
    let aus = "", fertig = false;
    const ende = (fehler?: Error) => { if (fertig) return; fertig = true; clearTimeout(uhr); if (fehler) { kind.kill(); reject(fehler); } else { try { resolve(JSON.parse(aus)); } catch { reject(Error("Extraktorantwort unlesbar.")); } } };
    const uhr = setTimeout(() => ende(Error("Extraktor-Zeitlimit erreicht.")), zeitlimit);
    kind.stdout.on("data", d => { aus += d; if (Buffer.byteLength(aus) > 2_000_000) ende(Error("Extraktorantwort zu groß.")); });
    kind.stderr.on("data", () => {});
    kind.on("error", () => ende(Error("Extraktor nicht startbar.")));
    kind.on("close", code => ende(code ? Error("Extraktor abgebrochen.") : undefined));
    kind.stdin.on("error", () => {});
    kind.stdin.end(JSON.stringify({ begriff, stadt, radius }));
  });
}

export async function scanIndeedViaJobspy(keywords: string[], city: string, radiusKm: number,
  lauf = jobspyLauf, speicher = zustand, jetzt = Date.now): Promise<IndeedCodexScan> {
  const terms = [...new Set(keywords.map(k => k.trim()).filter(Boolean))].slice(0, 5), completedKeywords: string[] = [];
  const offers = new Map<string, Offer>(); let cacheTreffer = 0, fehler = "";
  const report: SourceReport = { source: "indeed", status: "error", found: 0, inserted: 0, limited: true,
    keywords: terms.join(" · "), searchUrl: platformSearchUrl("indeed", terms[0] || "", city, radiusKm), message: "" };
  const gueltig = terms.length && terms.every(t => t.length <= 300) && city.trim() && city.length <= 300 && Number.isFinite(radiusKm) && radiusKm >= 1 && radiusKm <= 200;
  if (!gueltig) return { offers: [], completedKeywords, remainingKeywords: terms, report: { ...report, message: "Ungültige Indeed-Suchkriterien; keine Anfrage ausgeführt." } };
  for (const term of terms) {
    const schluessel = JSON.stringify([term, city, radiusKm]), da = speicher.cache.get(schluessel);
    try {
      let liste: Offer[];
      if (da && da.bis > jetzt()) { liste = da.offers; cacheTreffer++; }
      else {
        if (process.env.JOBPILOT_INDEED_TS_JOBSPY === "0") throw Error("Kostenloser Extraktor abgeschaltet.");
        if (speicher.gesperrtBis > jetzt()) throw Error("Extraktor in Ruhepause nach einem fehlgeschlagenen Abruf.");
        const roh = await lauf(term, city, radiusKm) as { status?: string; anfragen?: number; jobs?: unknown[] };
        if (!roh || !["ok", "empty", "partial"].includes(roh.status || "") || roh.anfragen !== 1 || !Array.isArray(roh.jobs)) throw Error("Extraktor hat keine bestätigte Trefferliste geliefert.");
        // Gemeinsame strenge Kartenprüfung: nur echte HTTPS-Indeed-Links, begrenzte Texte und belastbare Daten.
        const parsed = codexIndeedErgebnis({ structuredContent: { jobs: roh.jobs } });
        liste = parsed.offers.map(o => ({ ...o, externalRef: o.externalRef.replace(/^codex-/, "jobspy-") }));
        for (const o of liste) offers.set(o.externalRef, o);
        if (roh.status === "partial" || roh.jobs.length > 0 && !liste.length) throw Error("Extraktor hat nur eine unvollständige Trefferliste geliefert.");
        for (const [k, v] of speicher.cache) if (v.bis <= jetzt()) speicher.cache.delete(k);
        if (speicher.cache.size >= 100) speicher.cache.delete(speicher.cache.keys().next().value!);
        speicher.cache.set(schluessel, { bis: jetzt() + 10 * 60000, offers: liste });
      }
      for (const o of liste) { const vorher = offers.get(o.externalRef); if (!vorher || vorher.description.length < o.description.length) offers.set(o.externalRef, o); }
      completedKeywords.push(term);
    } catch (e) {
      fehler = e instanceof Error ? e.message : "Extraktorfehler.";
      // Keine erneute direkte Anfrage bei Sperre, Zeitlimit oder unbekanntem Fehler; danach nur offizielle Connectoren.
      if (process.env.JOBPILOT_INDEED_TS_JOBSPY !== "0") speicher.gesperrtBis = Math.max(speicher.gesperrtBis, jetzt() + 60 * 60000);
      break;
    }
  }
  report.found = offers.size; report.status = completedKeywords.length || offers.size ? "partial" : "error";
  report.message = `ts-jobspy (kostenlos): ${completedKeywords.length}/${terms.length} Suchen bestätigt, ${offers.size} Treffer, ${cacheTreffer} aus dem höchstens zehn Minuten alten Zwischenspeicher. ${fehler || "Teilabruf; Eignung und genauer Umkreis werden in JobPilot geprüft."}`;
  return { offers: [...offers.values()], report, completedKeywords, remainingKeywords: terms.filter(t => !completedKeywords.includes(t)) };
}
