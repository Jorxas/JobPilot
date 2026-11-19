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
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { angebote, beispielprofil, type Stelle } from "./beispiele";
import { aufnehmen, pruefeManuellenImport, searchPlan } from "./ablauf";
import { scanPublicSource, importPublicOffer } from "./kern/public";
import { searchJobs, jobPageUrl, getJobDetails } from "./kern/bundesagentur";
import { arbeitgeberLesen, type Arbeitgeber } from "./arbeitgeber";
import {
  SOURCES,
  searchUrl,
  textOnly,
  type SourceReport,
  type Offer,
} from "./kern/core";

type Zustand = {
  stellen: Stelle[];
  runde: number;
  abfrageIndex: number;
  seiten: Record<string, number>;
  berichte: SourceReport[];
  modus?: "live" | "synthetisch";
  suchraum?: string;
};
export function erstelleServer(
  optionen: { datenordner?: string; live?: boolean; wurzel?: string } = {},
) {
  const wurzel =
    optionen.wurzel || path.dirname(fileURLToPath(import.meta.url));
  const datenordner = optionen.datenordner || path.resolve("daten");
  const datei = path.join(datenordner, "zustand.json"),
    sperre = path.join(datenordner, "suche.sperre");
  const live = optionen.live === true;
  const anfang = (): Zustand => ({
    stellen: angebote.filter((s) => s.status === "applied"),
    runde: 0,
    abfrageIndex: 0,
    seiten: {},
    berichte: [],
  });
  async function lesen(): Promise<Zustand> {
    try {
      return JSON.parse(await readFile(datei, "utf8"));
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
  async function gesperrt<T>(arbeit: () => Promise<T>) {
    await mkdir(datenordner, { recursive: true });
    const token = randomUUID();
    let griff;
    try {
      griff = await open(sperre, "wx");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
      const s = await stat(sperre);
      if (Date.now() - s.mtimeMs < 600000)
        throw Object.assign(
          Error("Eine Suche läuft bereits. Bitte später erneut versuchen."),
          { status: 409 },
        );
      await unlink(sperre);
      try {
        griff = await open(sperre, "wx");
      } catch {
        throw Object.assign(Error("Eine andere Suche wurde gestartet."), {
          status: 409,
        });
      }
    }
    await griff.writeFile(token);
    await griff.close();
    try {
      return await arbeit();
    } finally {
      try {
        if ((await readFile(sperre, "utf8")) === token) await unlink(sperre);
      } catch {}
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
        if (req.method === "GET" && url.pathname === "/api/status")
          return antwort(200, {
            live,
            modus: "lokaler Server",
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
                throw Object.assign(
                  Error(
                    "URL-Abruf ist ohne explizit aktivierten Live-Modus gesperrt.",
                  ),
                  { status: 403 },
                );
              const ergebnis = aufnehmen(z.stellen, [angebot], beispielprofil);
              z.stellen = ergebnis.stellen;
              await speichern(z);
              return { ...ergebnis, zustand: z };
            }),
          );
        if (url.pathname === "/api/suche")
          return antwort(
            200,
            await gesperrt(async () => {
              const z = await lesen();
              if (inhalt.live === true && !live)
                throw Object.assign(
                  Error("Live-Suche ist am Server nicht freigeschaltet."),
                  { status: 403 },
                );
              const schluessel = String(
                  inhalt.keywords || "Werkstudent Software",
                ).slice(0, 180),
                stadt = String(inhalt.city || "Gießen").slice(0, 100),
                radius = Math.max(
                  1,
                  Math.min(200, Number(inhalt.radius) || 100),
                );
              const modus = inhalt.live === true ? "live" : "synthetisch";
              if (z.modus !== modus) {
                z.stellen = modus === "live" ? [] : anfang().stellen;
                z.runde = 0;
                z.abfrageIndex = 0;
                z.seiten = {};
                z.modus = modus;
              }
              const suchraum = [schluessel, stadt, radius].join("|");
              if (z.suchraum !== suchraum) {
                z.runde = 0;
                z.abfrageIndex = 0;
                z.seiten = {};
                z.suchraum = suchraum;
              }
              const plan = searchPlan(schluessel, true, z.runde),
                berichte: SourceReport[] = [];
              let eingang: Offer[] = [];
              if (inhalt.live === true) {
                let arbeitgeber: Arbeitgeber[] = [];
                try {
                  arbeitgeber = JSON.parse(
                    await readFile(
                      path.join(datenordner, "arbeitgeber.json"),
                      "utf8",
                    ),
                  );
                  if (!Array.isArray(arbeitgeber))
                    throw Error("Konfiguration muss eine Liste sein.");
                } catch (e) {
                  if ((e as NodeJS.ErrnoException).code !== "ENOENT")
                    throw Error("Arbeitgeberkonfiguration ist ungültig.");
                }
                for (const a of arbeitgeber.slice(0, 5)) {
                  if (typeof a.name !== "string" || typeof a.url !== "string")
                    continue;
                  const r = await arbeitgeberLesen(a);
                  eingang.push(...r.offers);
                  berichte.push(r.report);
                }
                // Zwei Suchvarianten pro Aufruf; Fortschritt und Seiten bleiben erhalten.
                for (const q of plan.slice(
                  z.abfrageIndex,
                  z.abfrageIndex + 2,
                )) {
                  const start = z.seiten[q.keywords] || 1;
                  let seite = start,
                    gefunden = 0,
                    abgeschlossen = false;
                  try {
                    for (; seite < start + 2; seite++) {
                      const daten = await searchJobs({
                        keywords: q.keywords,
                        city: stadt,
                        radiusKm: radius,
                        page: seite,
                        size: 25,
                      });
                      for (const d of daten) {
                        if (!d.title || !d.refnr) continue;
                        eingang.push({
                          source: "bundesagentur",
                          externalRef: d.refnr,
                          title: d.title,
                          company: d.company,
                          location: d.location,
                          url: d.externalUrl || jobPageUrl(d.refnr),
                          description: "",
                          complete: false,
                          distanceKm: d.distanceKm,
                        });
                        gefunden++;
                      }
                      if (daten.length < 25) {
                        abgeschlossen = true;
                        seite = 1;
                        break;
                      }
                    }
                    z.seiten[q.keywords] = seite;
                    berichte.push({
                      source: "bundesagentur",
                      status: "ok",
                      found: gefunden,
                      inserted: 0,
                      message: abgeschlossen
                        ? "Verfügbare Seiten dieses Suchlaufs gelesen."
                        : "Weitere Seiten bleiben für den nächsten Aufruf vorgemerkt.",
                      searchUrl: searchUrl(
                        "bundesagentur",
                        q.keywords,
                        stadt,
                        radius,
                      ),
                      keywords: q.keywords,
                      family: q.family,
                    });
                  } catch {
                    z.seiten[q.keywords] = seite;
                    berichte.push({
                      source: "bundesagentur",
                      status: "error",
                      found: gefunden,
                      inserted: 0,
                      message:
                        "Quelle nicht erreichbar; bereits gelesene Ergebnisse und Seitennummer bleiben erhalten.",
                      searchUrl: searchUrl(
                        "bundesagentur",
                        q.keywords,
                        stadt,
                        radius,
                      ),
                    });
                  }
                }
                const q = plan[z.abfrageIndex] || plan[0];
                for (const quelle of [
                  "linkedin",
                  "indeed",
                  "stepstone",
                ] as const) {
                  const r = await scanPublicSource(
                    quelle,
                    q.keywords,
                    stadt,
                    radius,
                  );
                  eingang.push(...r.offers);
                  berichte.push(r.report);
                }
                z.abfrageIndex += 2;
                if (z.abfrageIndex >= plan.length) {
                  z.runde++;
                  z.abfrageIndex = 0;
                }
              } else {
                eingang = angebote;
                z.runde++;
                berichte.push(
                  ...SOURCES.map((source) => ({
                    source,
                    status:
                      source === "indeed"
                        ? ("blocked" as const)
                        : source === "stepstone"
                          ? ("partial" as const)
                          : ("ok" as const),
                    found: angebote.filter((s) => s.source === source).length,
                    inserted: 0,
                    message:
                      "Simulierter Quellenzustand; es wurde keine Website aufgerufen.",
                    searchUrl: searchUrl(source, schluessel, stadt, radius),
                  })),
                );
              }
              const ergebnis = aufnehmen(z.stellen, eingang, beispielprofil);
              z.stellen = ergebnis.stellen;
              // Unvollständige BA-Beschreibungen begrenzt und nach Unterbrechungen erneut anreichern.
              if (inhalt.live === true) {
                const offen = z.stellen
                  .filter(
                    (s) =>
                      s.source === "bundesagentur" &&
                      !s.complete &&
                      (!s.nachladeVersuch ||
                        Date.now() - s.nachladeVersuch >= 6 * 3600000),
                  )
                  .slice(0, 12);
                for (const s of offen) {
                  s.nachladeVersuch = Date.now();
                  try {
                    const d = await getJobDetails(s.externalRef),
                      beschreibung = textOnly(d.descriptionText || "");
                    if (beschreibung.length >= 150) {
                      s.description = beschreibung;
                      s.complete = true;
                    }
                  } catch {
                    /* Fehlender Detailabruf bleibt ausdrücklich unvollständig. */
                  }
                }
              }
              z.berichte = berichte;
              await speichern(z);
              return {
                ...ergebnis,
                zustand: z,
                modus: inhalt.live === true ? "live" : "synthetisch",
                plan,
              };
            }),
          );
        return antwort(404, { fehler: "Unbekannter API-Pfad." });
      }
      if (!["GET", "HEAD"].includes(req.method || ""))
        return antwort(405, { fehler: "Nur Lesen erlaubt." });
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
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const server = erstelleServer({
    live: process.env.JOBPILOT_LIVE === "1",
    datenordner: process.env.JOBPILOT_DATEN,
  });
  server.listen(Number(process.env.PORT) || 3037, "127.0.0.1", () =>
    console.log(
      `JobPilot: http://127.0.0.1:${(server.address() as { port: number }).port}/ · Live-Suche ${process.env.JOBPILOT_LIVE === "1" ? "freigeschaltet" : "aus"}`,
    ),
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => server.close(() => process.exit()));
}
