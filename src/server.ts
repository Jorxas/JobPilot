import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  mkdir,
  readFile,
  writeFile,
  rename,
  open,
  stat,
  unlink,
  utimes,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import {
  angebote,
  beispielprofil,
  simulierteBerichte,
  type Stelle,
} from "./beispiele";
import { aufnehmen, normalizeKeywordList, pruefeManuellenImport } from "./ablauf";
import { importPublicOffer } from "./kern/public";
import { SOURCE_IDS, type PlatformId } from "./kern/platforms";
import {
  claudeLauf,
  indeedViaClaudeVerfuegbar,
  scanIndeedViaClaude,
} from "./kern/indeed-claude";
import {
  IndeedCodexUnavailable,
  indeedViaCodexVerfuegbar,
  openIndeedCodex,
  scanIndeedViaCodex,
} from "./kern/indeed-codex";
import {
  INDEED_PROVIDERS,
  scanIndeedViaConnector,
  type IndeedProvider,
} from "./kern/indeed-connectors";
import { type Arbeitgeber } from "./arbeitgeber";
import { geokodiererErstellen } from "./geokodierung";
import { liveSuche, type Lauf } from "./suche";
import { type SourceReport } from "./kern/core";

type Zustand = {
  stellen: Stelle[];
  runde: number;
  // Seitenstand der Bundesagentur je Suchbegriff.
  seiten: Record<string, number>;
  berichte: SourceReport[];
  modus?: "live" | "synthetisch";
  suchraum?: string;
  quellen?: PlatformId[];
  lauf?: Lauf;
  // Kriterien des letzten Live-Suchstarts; das Werkzeug suche-starten.mjs kann sie wiederverwenden.
  auftrag?: { city: string; radius: number; keywordList: string[]; quellen: PlatformId[]; breit: boolean };
  // Älterer Stand (zwei Suchvarianten je Aufruf); wird nicht mehr verwendet.
  abfrageIndex?: number;
};
type Sperre = { erneuern: () => Promise<void>; freigeben: () => Promise<void> };
export type ServerOptionen = {
  datenordner?: string;
  live?: boolean;
  wurzel?: string;
  // Ortsauflösung über OpenStreetMap Nominatim für die Umkreisprüfung (Standard: an, JOBPILOT_GEOKODIERUNG=0 schaltet ab).
  geokodierung?: boolean;
  // Indeed über den Claude-Connector: nur mit JOBPILOT_INDEED_CLAUDE=1 und installiertem Claude Code.
  indeedClaude?: { verfuegbar: boolean; lauf?: (auftrag: string) => Promise<string> };
  // Indeed über ChatGPT/Codex: nur mit JOBPILOT_INDEED_CODEX=1 und installiertem Codex. Für Prüfungen lässt sich die
  // Umgebung des Codex-Prozesses vorgeben (zum Beispiel ein synthetischer App-Server über JOBPILOT_CODEX_CLI).
  indeedCodex?: { verfuegbar: boolean; umgebung?: NodeJS.ProcessEnv };
};
const STALE_MS = 600000;
const fehler = (nachricht: string, status = 400) =>
  Object.assign(Error(nachricht), { status });
// Gewählte Plattformen in der Reihenfolge des Katalogs (sie bestimmt die Spur im Suchplan). Ohne Angabe alle 21.
export function quellenAus(wert: unknown): PlatformId[] {
  if (wert === undefined || wert === null) return [...SOURCE_IDS];
  if (!Array.isArray(wert))
    throw fehler("Plattformen bitte als Liste übergeben.");
  const quellen = SOURCE_IDS.filter((id) => wert.includes(id));
  if (!quellen.length) throw fehler("Mindestens eine Plattform auswählen.");
  return quellen;
}
// Indeed-Anbieter eines manuellen Suchstarts: auto, codex oder claude. Ohne Angabe startet kein Connector (wie
// zeitgesteuerte Aufrufe im Original). Die ältere Angabe indeedUeberClaude: true entspricht „claude“.
export function indeedAnbieterAus(inhalt: Record<string, unknown>): IndeedProvider | undefined {
  const wert = inhalt.indeedProvider ?? (inhalt.indeedUeberClaude === true ? "claude" : undefined);
  if (wert === undefined) return undefined;
  if (!INDEED_PROVIDERS.includes(wert as IndeedProvider))
    throw fehler("Unbekannter Indeed-Suchassistent. Erlaubt: auto, codex oder claude.");
  const vorgabe = process.env.JOBPILOT_INDEED_PROVIDER;
  if (wert === "auto" && vorgabe && !INDEED_PROVIDERS.includes(vorgabe as IndeedProvider))
    throw fehler("JOBPILOT_INDEED_PROVIDER muss auto, codex oder claude sein; keine Suche gestartet.", 500);
  return wert as IndeedProvider;
}
export function erstelleServer(optionen: ServerOptionen = {}) {
  const wurzel =
    path.resolve(optionen.wurzel || path.dirname(fileURLToPath(import.meta.url)));
  const datenordner = optionen.datenordner || path.resolve("daten");
  const datei = path.join(datenordner, "zustand.json"),
    sperre = path.join(datenordner, "suche.sperre");
  const live = optionen.live === true;
  const geoAktiv =
    optionen.geokodierung ?? process.env.JOBPILOT_GEOKODIERUNG !== "0";
  const indeed = optionen.indeedClaude || {
    verfuegbar: indeedViaClaudeVerfuegbar(),
    lauf: (auftrag: string) => claudeLauf(auftrag),
  };
  const codex = optionen.indeedCodex || { verfuegbar: indeedViaCodexVerfuegbar() };
  // Kostenloser Erstabruf zuerst; offizielle Ersatzwege starten nur mit ihrer jeweiligen Kontofreigabe.
  const connector = (anbieter: IndeedProvider) => (begriffe: string[], stadt: string, radius: number) =>
    scanIndeedViaConnector(begriffe, stadt, radius, anbieter, {
      codex: (b, s, r) =>
        scanIndeedViaCodex(b, s, r, codex.verfuegbar
          ? () => openIndeedCodex(codex.umgebung || process.env)
          : async () => { throw new IndeedCodexUnavailable("Indeed über ChatGPT/Codex ist am Server nicht freigeschaltet (JOBPILOT_INDEED_CODEX=1)."); }),
      claude: (b, s, r) => scanIndeedViaClaude(b, s, r, indeed.lauf || ((auftrag: string) => claudeLauf(auftrag))),
      claudeAvailable: () => indeed.verfuegbar,
    });
  let aktuelleSuche: Promise<unknown> | null = null;
  const anfang = (): Zustand => ({
    stellen: angebote.filter((s) => s.status === "applied"),
    runde: 0,
    seiten: {},
    berichte: [],
  });
  async function lesen(): Promise<Zustand> {
    try {
      const z = JSON.parse(await readFile(datei, "utf8"));
      z.seiten ||= {};
      z.berichte ||= [];
      return z;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return anfang();
      throw e;
    }
  }
  async function speichern(z: Zustand) {
    await mkdir(datenordner, { recursive: true });
    const tmp = datei + "." + randomUUID() + ".tmp";
    await writeFile(tmp, JSON.stringify(z, null, 2));
    await rename(tmp, datei);
  }
  // Exklusive Dateisperre mit Token. Lange Suchläufe erneuern sie nach jeder Anfrage, damit sie nicht als veraltet gilt.
  async function sperreHolen(): Promise<Sperre> {
    await mkdir(datenordner, { recursive: true });
    const token = randomUUID();
    let griff;
    try {
      griff = await open(sperre, "wx");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      const s = await stat(sperre);
      if (Date.now() - s.mtimeMs < STALE_MS)
        throw fehler(
          "Eine Suche läuft bereits. Bitte später erneut versuchen.",
          409,
        );
      await unlink(sperre);
      try {
        griff = await open(sperre, "wx");
      } catch {
        throw fehler("Eine andere Suche wurde gestartet.", 409);
      }
    }
    await griff.writeFile(token);
    await griff.close();
    const eigen = async () => {
      try {
        return (await readFile(sperre, "utf8")) === token;
      } catch {
        return false;
      }
    };
    return {
      async erneuern() {
        if (await eigen()) {
          const jetzt = new Date();
          await utimes(sperre, jetzt, jetzt).catch(() => {});
        }
      },
      async freigeben() {
        if (await eigen()) await unlink(sperre).catch(() => {});
      },
    };
  }
  async function gesperrt<T>(arbeit: () => Promise<T>) {
    const s = await sperreHolen();
    try {
      return await arbeit();
    } finally {
      await s.freigeben();
    }
  }
  async function arbeitgeberKonfiguration(): Promise<Arbeitgeber[]> {
    try {
      const liste = JSON.parse(
        await readFile(path.join(datenordner, "arbeitgeber.json"), "utf8"),
      );
      if (!Array.isArray(liste)) throw Error("Konfiguration muss eine Liste sein.");
      return liste;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw Error("Arbeitgeberkonfiguration ist ungültig.");
    }
  }
  async function suche(inhalt: Record<string, unknown>) {
    if (inhalt.live === true && !live)
      throw fehler("Live-Suche ist am Server nicht freigeschaltet.", 403);
    // Vor Sperre und erster Anfrage prüfen: ein ungültiger Anbieter startet nichts.
    const anbieter = indeedAnbieterAus(inhalt);
    const quellen = quellenAus(inhalt.quellen);
    const schluessel = String(inhalt.keywords || "Werkstudent Software").slice(
        0,
        180,
      ),
      liste = normalizeKeywordList(
        Array.isArray(inhalt.keywordList) ? inhalt.keywordList : [],
      ),
      begriffe = liste.length ? liste : normalizeKeywordList([schluessel]),
      stadt = String(inhalt.city || "Gießen").slice(0, 100),
      radius = Math.max(1, Math.min(200, Number(inhalt.radius) || 100));
    const s = await sperreHolen();
    let freigeben = true;
    try {
      const z = await lesen();
      const modus = inhalt.live === true ? "live" : "synthetisch";
      if (z.modus !== modus) {
        z.stellen = modus === "live" ? [] : anfang().stellen;
        z.runde = 0;
        z.seiten = {};
        z.berichte = [];
        delete z.lauf;
        z.modus = modus;
      }
      // Wie im Original: ein anderer Ort oder Umkreis beginnt die Rotation neu; Stellen und Historie bleiben.
      const suchraum = [stadt, radius].join("|");
      if (z.suchraum !== suchraum) {
        z.runde = 0;
        z.seiten = {};
        z.suchraum = suchraum;
      }
      delete z.abfrageIndex;
      z.quellen = quellen;
      if (modus === "synthetisch") {
        z.runde++;
        z.berichte = simulierteBerichte(quellen, angebote, begriffe[0], stadt, radius);
        const ergebnis = aufnehmen(z.stellen, angebote, beispielprofil);
        z.stellen = ergebnis.stellen;
        await speichern(z);
        return { status: 200, daten: { ...ergebnis, zustand: z, modus } };
      }
      z.auftrag = { city: stadt, radius, keywordList: begriffe, quellen, breit: inhalt.breit !== false };
      const geo = await geokodiererErstellen({
        datei: path.join(datenordner, "geocache.json"),
        aktiv: geoAktiv,
      });
      const arbeit = liveSuche(
        z,
        {
          stadt,
          radius,
          begriffe,
          breit: inhalt.breit !== false,
          quellen,
          arbeitgeber: await arbeitgeberKonfiguration(),
        },
        {
          speichern: () => speichern(z),
          erneuern: s.erneuern,
          geo,
          profil: beispielprofil,
          // Manueller Auftrag: Der kostenlose Erstabruf braucht keine Freigabe eines offiziellen Kontos.
          indeedConnector:
            anbieter
              ? connector(anbieter)
              : undefined,
        },
      ).then((e) => ({ ...e, zustand: z, modus }));
      if (inhalt.hintergrund === true) {
        // Lange Läufe (fünf Durchläufe, bis zu 21 Plattformen) laufen weiter, auch wenn der Browser die Antwort nicht abwartet.
        freigeben = false;
        aktuelleSuche = arbeit
          .catch(() => {})
          .finally(() => s.freigeben());
        return { status: 202, daten: { gestartet: true, zustand: z, modus } };
      }
      return { status: 200, daten: await arbeit };
    } finally {
      if (freigeben) await s.freigeben();
    }
  }
  const server = http.createServer(async (req, res) => {
    const antwort = (status: number, daten: unknown) => {
      res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      });
      res.end(JSON.stringify(daten));
    };
    try {
      const url = new URL(req.url || "/", "http://localhost");
      if (url.pathname.startsWith("/api/")) {
        if (
          (req.headers.origin &&
            req.headers.origin !== `http://${req.headers.host}` &&
            req.headers.origin !== `https://${req.headers.host}`) ||
          req.headers["sec-fetch-site"] === "cross-site"
        )
          return antwort(403, {
            fehler: "Nur Aufrufe aus der lokalen Anwendung sind erlaubt.",
          });
        // Lesende Fähigkeitsabfrage für das Werkzeug suche-starten.mjs; liest keinen Zustand und startet nichts.
        if (req.method === "GET" && url.pathname === "/api/suche")
          return antwort(200, {
            manualSearchCommandVersion: 1,
            indeedProviders: INDEED_PROVIDERS,
            indeedPrimary: "ts-jobspy",
            indeedConnectoren: {
              codex: live && codex.verfuegbar,
              claude: live && indeed.verfuegbar,
            },
            indeedVorgabe: process.env.JOBPILOT_INDEED_PROVIDER || "auto",
            live,
            plattformen: SOURCE_IDS,
          });
        if (req.method === "GET" && url.pathname === "/api/status")
          return antwort(200, {
            live,
            modus: "lokaler Server",
            indeedClaude: live && indeed.verfuegbar,
            indeedCodex: live && codex.verfuegbar,
            geokodierung: geoAktiv,
            zustand: await lesen(),
          });
        if (req.method !== "POST")
          return antwort(405, {
            fehler: "Diese Methode ist nicht vorgesehen.",
          });
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return antwort(415, { fehler: "JSON-Anfrage erforderlich." });
        let text = "";
        for await (const block of req) {
          text += block;
          if (Buffer.byteLength(text) > 32768)
            return antwort(413, { fehler: "Anfrage zu groß." });
        }
        let inhalt: Record<string, unknown>;
        try {
          inhalt = JSON.parse(text || "{}");
        } catch {
          return antwort(400, { fehler: "Ungültige JSON-Daten." });
        }
        if (url.pathname === "/api/zuruecksetzen")
          return antwort(
            200,
            await gesperrt(async () => {
              const z = anfang();
              await speichern(z);
              return z;
            }),
          );
        if (url.pathname === "/api/beschreibung")
          return antwort(
            200,
            await gesperrt(async () => {
              const beschreibung = String(inhalt.description || "").trim();
              if (beschreibung.length < 150 || beschreibung.length > 20000)
                throw Error(
                  "Beschreibung muss 150 bis 20.000 Zeichen enthalten.",
                );
              const z = await lesen(),
                s = z.stellen.find((s) => s.id === inhalt.id);
              if (!s) throw Error("Stelle nicht gefunden.");
              s.description = beschreibung;
              s.complete = true;
              await speichern(z);
              return { gespeichert: true };
            }),
          );
        if (url.pathname === "/api/status-aendern")
          return antwort(
            200,
            await gesperrt(async () => {
              if (
                !["pending", "applied", "archived"].includes(
                  String(inhalt.status),
                )
              )
                throw Error("Ungültiger Status.");
              const z = await lesen(),
                stelle = z.stellen.find((s) => s.id === inhalt.id);
              if (!stelle) throw Error("Stelle nicht gefunden.");
              stelle.status = inhalt.status as Stelle["status"];
              await speichern(z);
              return { gespeichert: true };
            }),
          );
        if (url.pathname === "/api/import")
          return antwort(
            200,
            await gesperrt(async () => {
              const z = await lesen();
              const angebot =
                inhalt.urlImport === true
                  ? live
                    ? await importPublicOffer(String(inhalt.url))
                    : null
                  : pruefeManuellenImport(inhalt);
              if (!angebot)
                throw fehler(
                  "URL-Abruf ist ohne explizit aktivierten Live-Modus gesperrt.",
                  403,
                );
              const ergebnis = aufnehmen(z.stellen, [angebot], beispielprofil);
              z.stellen = ergebnis.stellen;
              await speichern(z);
              return { ...ergebnis, zustand: z };
            }),
          );
        if (url.pathname === "/api/suche") {
          const r = await suche(inhalt);
          return antwort(r.status, r.daten);
        }
        return antwort(404, { fehler: "Unbekannter API-Pfad." });
      }
      if (!["GET", "HEAD"].includes(req.method || ""))
        return antwort(405, { fehler: "Nur Lesen erlaubt." });
      // Die echte Suchseite verwendet den lokalen Server, ohne den synthetischen Demo-Datenadapter.
      if(url.pathname==='/'){
        res.writeHead(302,{Location:'/offres','Cache-Control':'no-store'});
        return res.end();
      }
      if(url.pathname==='/offres'){
        const html=(await readFile(path.join(wurzel,'index.html'),'utf8')).replace(/<script src="\.\/assets\/demo\.js"><\/script>/,'');
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
        return res.end(req.method==='HEAD'?undefined:html);
      }
      const relativ = decodeURIComponent(url.pathname).replace(/^\/+/, ""),
        ziel = path.resolve(wurzel, relativ || "index.html");
      if (ziel !== wurzel && !ziel.startsWith(wurzel + path.sep))
        return antwort(403, { fehler: "Ungültiger Dateipfad." });
      // Der lokale Servercode und Laufzeitdaten gehören nicht zur Weboberfläche.
      if (/\.mjs$/.test(relativ))
        return antwort(404, { fehler: "Nicht öffentlich." });
      let pfad = ziel;
      try {
        if ((await stat(pfad)).isDirectory())
          pfad = path.join(pfad, "index.html");
        const daten = await readFile(pfad);
        const typen: Record<string, string> = {
          ".html": "text/html; charset=utf-8",
          ".js": "text/javascript; charset=utf-8",
          ".css": "text/css; charset=utf-8",
          ".json": "application/json; charset=utf-8",
          ".svg": "image/svg+xml",
          ".png": "image/png",
          ".pdf": "application/pdf",
          ".woff2": "font/woff2",
          ".txt": "text/plain; charset=utf-8",
        };
        res.writeHead(200, {
          "Content-Type":
            typen[path.extname(pfad)] || "application/octet-stream",
          "X-Content-Type-Options": "nosniff",
        });
        res.end(req.method === "HEAD" ? undefined : daten);
      } catch {
        return antwort(404, { fehler: "Datei nicht gefunden." });
      }
    } catch (e) {
      antwort((e as { status?: number }).status || 400, {
        fehler:
          e instanceof Error
            ? e.message
            : "Die Anfrage konnte nicht verarbeitet werden.",
      });
    }
  });
  // Für Prüfungen: den im Hintergrund laufenden Suchstart abwarten.
  return Object.assign(server, { suchlauf: () => aktuelleSuche });
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const live = process.env.JOBPILOT_LIVE === "1";
  const server = erstelleServer({
    live,
    datenordner: process.env.JOBPILOT_DATEN,
  });
  server.listen(Number(process.env.PORT) || 3037, "127.0.0.1", () =>
    console.log(
      `JobPilot: http://127.0.0.1:${(server.address() as { port: number }).port}/ · Live-Suche ${live ? "freigeschaltet" : "aus"}` +
        (live
          ? ` · Indeed über ChatGPT/Codex ${indeedViaCodexVerfuegbar() ? "freigeschaltet" : "aus"}` +
            ` · Indeed über Claude ${indeedViaClaudeVerfuegbar() ? "freigeschaltet" : "aus"}`
          : ""),
    ),
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => server.close(() => process.exit()));
}
