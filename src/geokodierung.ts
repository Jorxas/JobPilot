// Ortsauflösung für die Umkreisprüfung der öffentlichen Fassung.
// Das private Original nutzt einen persönlichen Ortscache; dieser wird nicht veröffentlicht. Stattdessen werden
// unbekannte Orte (Postleitzahl oder Ortsname aus der Anzeige sowie der eigene Suchort) einzeln über
// OpenStreetMap Nominatim aufgelöst und lokal unter daten/geocache.json zwischengespeichert.
// Regeln der Nominatim-Nutzungsrichtlinie: ehrliche Kennung, höchstens eine Anfrage je Sekunde, Ergebnisse
// zwischenspeichern, keine Massenabfragen. Deshalb gilt je Suchstart ein festes Kontingent; bei Fehlern oder
// Sperren (HTTP 403/429) wird für diesen Suchstart nicht weiter gefragt. Geodaten © OpenStreetMap-Mitwirkende, ODbL 1.0.
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { isRegion, offerPlaces, placeKey, type GeoCache } from "./kern/scope";

export const NOMINATIM = "https://nominatim.openstreetmap.org/search";
export const KENNUNG = "JobPilot/1.0 (lokale private Stellensuche; +https://github.com/Jorxas/JobPilot)";
export const KONTINGENT_JE_SUCHE = 60;
const ABSTAND_MS = 1100, ERNEUT_NACH_MS = 30 * 86400000;
// Nur Siedlungen und Postleitzahlen sind Einsatzorte; Bundesländer, Landkreise oder Staaten liefern keinen Mittelpunkt.
const ORTSARTEN = new Set(["city", "town", "village", "hamlet", "suburb", "borough", "municipality", "quarter", "neighbourhood", "city_district", "isolated_dwelling", "locality", "postcode"]);

type Datei = { hinweis?: string; orte: GeoCache; geprueft: Record<string, string> };
export type Geokodierer = {
  cache: GeoCache;
  aufloesen(orte: (string | null | undefined)[]): Promise<void>;
  anfragen(): number;
  meldung(): string | undefined;
};
export type GeoOptionen = {
  datei: string;
  aktiv: boolean;
  kontingent?: number;
  abruf?: typeof fetch;
  jetzt?: () => number;
  warten?: (ms: number) => Promise<void>;
};

// Gemeinsamer Takt über alle Suchstarts dieses Prozesses: mindestens 1,1 Sekunden zwischen zwei Anfragen.
let letzteAnfrage = 0;

// Schlüssel wie in scope.ts: zuerst die Postleitzahl, sonst der normalisierte Ortsname.
export function ortsAnfrage(ort: string): { schluessel: string; parameter: Record<string, string> } | null {
  if (!ort.trim() || isRegion(ort)) return null;
  const { postcode, city } = placeKey(ort);
  // Gießen ist in scope.ts fest hinterlegt (gleicher Mittelpunkt wie im Original) und braucht keine Abfrage.
  if (city === "giessen") return null;
  if (postcode) return { schluessel: postcode, parameter: { postalcode: postcode } };
  if (!city || city.length < 2 || /\d/.test(city)) return null;
  const name = ort.replace(/\b\d{5}\b/g, "").split(/[·|/(,;–—]/)[0].trim();
  return { schluessel: city, parameter: { q: name } };
}

async function lesen(datei: string): Promise<Datei> {
  try {
    const d = JSON.parse(await readFile(datei, "utf8"));
    const orte: GeoCache = {}, geprueft: Record<string, string> = {};
    for (const [k, v] of Object.entries(d?.orte || {})) {
      const p = v as { lat?: unknown; lon?: unknown } | null;
      if (p === null) orte[k] = null;
      else if (p && Number.isFinite(p.lat) && Number.isFinite(p.lon)) orte[k] = { lat: Number(p.lat), lon: Number(p.lon) };
    }
    for (const [k, v] of Object.entries(d?.geprueft || {})) if (typeof v === "string") geprueft[k] = v;
    return { orte, geprueft };
  } catch {
    return { orte: {}, geprueft: {} };
  }
}

export async function geokodiererErstellen(o: GeoOptionen): Promise<Geokodierer> {
  const abruf = o.abruf || ((...a: Parameters<typeof fetch>) => fetch(...a));
  const jetzt = o.jetzt || Date.now, warten = o.warten || ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));
  const daten = await lesen(o.datei);
  let rest = o.kontingent ?? KONTINGENT_JE_SUCHE, gestellt = 0, gestoppt = false, hinweis: string | undefined;
  async function speichern() {
    await mkdir(path.dirname(o.datei), { recursive: true });
    const tmp = o.datei + "." + randomUUID() + ".tmp";
    await writeFile(tmp, JSON.stringify({ hinweis: "Geodaten © OpenStreetMap-Mitwirkende, ODbL 1.0; über Nominatim aufgelöst. Lokaler Zwischenspeicher.", orte: daten.orte, geprueft: daten.geprueft }, null, 1));
    await rename(tmp, o.datei);
  }
  async function frage(parameter: Record<string, string>) {
    const seit = jetzt() - letzteAnfrage;
    if (seit < ABSTAND_MS) await warten(ABSTAND_MS - seit);
    letzteAnfrage = jetzt();
    gestellt++;
    const url = NOMINATIM + "?" + new URLSearchParams({ ...parameter, countrycodes: "de", format: "jsonv2", limit: "5", "accept-language": "de" });
    const r = await abruf(url, { headers: { "User-Agent": KENNUNG, Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
    if (!r.ok) throw Object.assign(Error("HTTP " + r.status), { status: r.status });
    const liste = await r.json();
    if (!Array.isArray(liste)) throw Error("Unerwartete Antwort");
    // Ohne addresstype (ältere Ausgabe) entscheidet der Rang: Siedlungen liegen etwa zwischen 13 und 25, Länder und Kreise darunter.
    const siedlung = (t: { addresstype?: unknown; place_rank?: unknown }) => t.addresstype !== undefined ? ORTSARTEN.has(String(t.addresstype)) : Number(t.place_rank) >= 13 && Number(t.place_rank) <= 25;
    const treffer = liste.find(t => t && siedlung(t) && Number.isFinite(Number(t.lat)) && Number.isFinite(Number(t.lon)));
    return treffer ? { lat: Math.round(Number(treffer.lat) * 1e4) / 1e4, lon: Math.round(Number(treffer.lon) * 1e4) / 1e4 } : null;
  }
  return {
    cache: daten.orte,
    anfragen: () => gestellt,
    meldung: () => hinweis,
    async aufloesen(eingabe) {
      if (!o.aktiv || gestoppt) return;
      const offen = new Map<string, Record<string, string>>();
      for (const roh of eingabe) for (const ort of roh ? offerPlaces(roh) : []) {
        const a = ortsAnfrage(ort);
        if (!a || offen.has(a.schluessel)) continue;
        const bekannt = daten.orte[a.schluessel], zuletzt = Date.parse(daten.geprueft[a.schluessel] || "");
        if (bekannt || (bekannt === null && Number.isFinite(zuletzt) && jetzt() - zuletzt < ERNEUT_NACH_MS)) continue;
        offen.set(a.schluessel, a.parameter);
      }
      let geaendert = false;
      for (const [schluessel, parameter] of offen) {
        if (rest <= 0) { hinweis ??= `Kontingent von ${o.kontingent ?? KONTINGENT_JE_SUCHE} Ortsabfragen je Suchstart erreicht; weitere Orte folgen bei der nächsten Suche.`; break; }
        rest--;
        try {
          daten.orte[schluessel] = await frage(parameter);
          daten.geprueft[schluessel] = new Date(jetzt()).toISOString().slice(0, 10);
          geaendert = true;
        } catch (e) {
          gestoppt = true;
          const status = (e as { status?: number }).status;
          hinweis = `Ortsauflösung über OpenStreetMap nicht verfügbar${status ? " (HTTP " + status + ")" : ""}; für diesen Suchstart keine weiteren Ortsabfragen.`;
          break;
        }
      }
      if (geaendert) await speichern();
    },
  };
}
