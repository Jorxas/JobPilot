// Ortsauflösung für die Umkreisprüfung: Nominatim wird vollständig gemockt; es gibt keine echte Anfrage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  geokodiererErstellen,
  KENNUNG,
  ortsAnfrage,
} from "../dist/geokodierung.mjs";
import { publicOfferScope } from "../dist/umkreis.mjs";

const ORTE = {
  "Köln": { lat: "50.9384", lon: "6.9599", addresstype: "city" },
  "Bonn": { lat: "50.7353", lon: "7.1007", addresstype: "city" },
  "Dortmund": { lat: "51.5142", lon: "7.4652", addresstype: "city" },
  "50667": { lat: "50.9375", lon: "6.9603", addresstype: "postcode" },
};
function nominatim(protokoll, status = 200) {
  return async (url, init) => {
    const u = new URL(url);
    protokoll.push({ url: u, headers: init.headers });
    if (status !== 200) return new Response("", { status });
    const ort = u.searchParams.get("q") || u.searchParams.get("postalcode");
    if (ort === "Hessen") return Response.json([{ lat: "50.6", lon: "9.0", addresstype: "state" }]);
    return Response.json(ORTE[ort] ? [ORTE[ort]] : []);
  };
}
async function mitOrdner(arbeit) {
  const ordner = await mkdtemp(path.join(os.tmpdir(), "jobpilot-geo-test-"));
  try {
    return await arbeit(path.join(ordner, "geocache.json"));
  } finally {
    await rm(ordner, { recursive: true, force: true });
  }
}
const offer = { title: "Werkstudent Softwareentwicklung", description: "" };

test("Ortsschlüssel: Postleitzahl vor Ortsname; Bundesländer, Fernarbeit und Gießen werden nie abgefragt", () => {
  assert.deepEqual(ortsAnfrage("50667 Köln"), { schluessel: "50667", parameter: { postalcode: "50667" } });
  assert.deepEqual(ortsAnfrage("Köln (Innenstadt)"), { schluessel: "koln", parameter: { q: "Köln" } });
  for (const ort of ["Hessen", "Deutschland", "Remote", "Homeoffice", "35390 Gießen", "Gießen", " "])
    assert.equal(ortsAnfrage(ort), null, ort);
});

test("Unbekannte Orte werden einzeln, mit ehrlicher Kennung und höchstens einmal je Sekunde aufgelöst und gespeichert", async () => {
  await mitOrdner(async (datei) => {
    const protokoll = [], wartezeiten = [];
    let uhr = 1_000_000;
    const geo = await geokodiererErstellen({ datei, aktiv: true, abruf: nominatim(protokoll), jetzt: () => uhr, warten: async (ms) => { wartezeiten.push(ms); uhr += ms; } });
    await geo.aufloesen(["Köln", "53111 Bonn, Hessen", "Bonn", "Köln", "Dortmund", "Remote", null]);
    // Köln, 53111 (unbekannte Postleitzahl), Bonn, Dortmund: vier Anfragen, keine für Hessen, Remote oder Wiederholungen.
    assert.equal(protokoll.length, 4);
    assert(protokoll.every((p) => p.url.origin === "https://nominatim.openstreetmap.org" && p.url.searchParams.get("countrycodes") === "de"));
    assert(protokoll.every((p) => p.headers["User-Agent"] === KENNUNG));
    assert.match(KENNUNG, /^JobPilot\/.+github\.com\/Jorxas\/JobPilot/);
    assert(wartezeiten.length >= 3 && wartezeiten.every((ms) => ms >= 1000), "Mindestabstand zwischen Anfragen");
    assert.deepEqual(geo.cache.koln, { lat: 50.9384, lon: 6.9599 });
    assert.equal(geo.cache["53111"], null, "Nicht gefunden wird als unbekannt gemerkt");
    const gespeichert = JSON.parse(await readFile(datei, "utf8"));
    assert.match(gespeichert.hinweis, /OpenStreetMap/);
    assert.deepEqual(gespeichert.orte.dortmund, { lat: 51.5142, lon: 7.4652 });
    // Umkreis um einen anderen Ort als Gießen.
    assert.equal(publicOfferScope({ ...offer, location: "Bonn" }, "Köln", 30, geo.cache), "ok");
    assert.equal(publicOfferScope({ ...offer, location: "Dortmund" }, "Köln", 30, geo.cache), "outside");
    assert.equal(publicOfferScope({ ...offer, location: "53111 Bonn" }, "Köln", 30, geo.cache), "unknown", "Postleitzahl ohne Treffer wird nicht geraten");
    // Ein zweiter Suchstart liest aus dem Zwischenspeicher und fragt nicht erneut.
    const zweiter = await geokodiererErstellen({ datei, aktiv: true, abruf: nominatim(protokoll), jetzt: () => uhr, warten: async (ms) => { uhr += ms; } });
    await zweiter.aufloesen(["Köln", "Bonn", "53111 Bonn", "Dortmund"]);
    assert.equal(protokoll.length, 4);
    // Nicht gefundene Orte werden frühestens nach 30 Tagen erneut gefragt.
    uhr += 31 * 86400000;
    const spaeter = await geokodiererErstellen({ datei, aktiv: true, abruf: nominatim(protokoll), jetzt: () => uhr, warten: async (ms) => { uhr += ms; } });
    await spaeter.aufloesen(["53111 Bonn", "Köln"]);
    assert.equal(protokoll.length, 5);
  });
});

test("Nur Siedlungen und Postleitzahlen zählen; Kontingent je Suchstart; Sperre beendet weitere Abfragen", async () => {
  await mitOrdner(async (datei) => {
    const protokoll = [];
    let uhr = 5_000_000;
    const warten = async (ms) => { uhr += ms; };
    const geo = await geokodiererErstellen({ datei, aktiv: true, kontingent: 2, abruf: nominatim(protokoll), jetzt: () => uhr, warten });
    await geo.aufloesen(["Köln", "Bonn", "Dortmund"]);
    assert.equal(protokoll.length, 2, "Kontingent");
    assert.match(geo.meldung(), /Kontingent von 2 Ortsabfragen/);
    assert.equal(geo.cache.dortmund, undefined);
    const gesperrt = [];
    const zu = await geokodiererErstellen({ datei, aktiv: true, abruf: nominatim(gesperrt, 429), jetzt: () => uhr, warten });
    await zu.aufloesen(["Dortmund", "Leipzig", "Dresden"]);
    await zu.aufloesen(["Erfurt"]);
    assert.equal(gesperrt.length, 1, "Nach HTTP 429 keine weitere Anfrage in diesem Suchstart");
    assert.match(zu.meldung(), /HTTP 429/);
    assert.equal(zu.cache.dortmund, undefined, "Fehler wird nicht als unbekannter Ort gespeichert");
    const aus = [];
    const ohne = await geokodiererErstellen({ datei, aktiv: false, abruf: nominatim(aus), jetzt: () => uhr, warten });
    await ohne.aufloesen(["Dortmund"]);
    assert.equal(aus.length, 0, "JOBPILOT_GEOKODIERUNG=0: keine Anfrage");
  });
  // Ein Bundesland als einziger Ort ergibt keinen Mittelpunkt.
  await mitOrdner(async (datei) => {
    await writeFile(datei, JSON.stringify({ orte: {}, geprueft: {} }));
    const protokoll = [];
    const geo = await geokodiererErstellen({ datei, aktiv: true, abruf: async (url, init) => { protokoll.push(url); return Response.json([{ lat: "50.6", lon: "9.0", addresstype: "state" }]); }, jetzt: () => 9_000_000, warten: async () => {} });
    await geo.aufloesen(["Nordhessen"]);
    assert.equal(protokoll.length, 1);
    assert.equal(geo.cache.nordhessen, null);
    // Ältere Ausgabe ohne addresstype: Rang einer Stadt wird angenommen, Rang eines Landes nicht.
    const alt = await geokodiererErstellen({ datei, aktiv: true, abruf: async (url) => Response.json(new URL(url).searchParams.get("q") === "Altstadt" ? [{ lat: "50.1", lon: "8.1", place_rank: 16 }] : [{ lat: "51", lon: "10", place_rank: 4 }]), jetzt: () => 9_500_000, warten: async () => {} });
    await alt.aufloesen(["Altstadt", "Irgendwoland"]);
    assert.deepEqual(alt.cache.altstadt, { lat: 50.1, lon: 8.1 });
    assert.equal(alt.cache.irgendwoland, null);
  });
});
