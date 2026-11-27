// Plattformparser gegen gekürzte echte Trefferlisten (pruefungen/fixtures/karten/<plattform>.html + .json),
// übernommen aus dem privaten Original; Kontaktpersonen, Telefonnummern und E-Mail-Adressen sind ersetzt.
// Jede .json nennt Quelle, Suchadresse, erwartete Kartenzahl und die erste Karte. Kein Netzwerkzugriff.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  cardOffers,
  parseOffers,
  scanPublicSource,
  sourceOf,
} from "../dist/quellen.mjs";
import { SOURCE_IDS } from "../dist/plattformen.mjs";
import { SEITEN } from "../dist/karten.mjs";

const ordner = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "fixtures/karten",
);
for (const datei of readdirSync(ordner).filter((f) => f.endsWith(".json"))) {
  const spec = JSON.parse(readFileSync(path.join(ordner, datei), "utf8"));
  test(`Trefferliste ${spec.source}: ${spec.count} Karten mit Titel, Firma und eigenem Anzeigenlink`, () => {
    const html = readFileSync(
      path.join(ordner, datei.replace(/\.json$/, ".html")),
      "utf8",
    );
    const offers = parseOffers(html, spec.base, spec.source);
    assert.equal(offers.length, spec.count);
    for (const o of offers) {
      assert.equal(o.source, spec.source);
      assert(o.title && o.url.startsWith("https://"), JSON.stringify(o));
      assert.equal(
        sourceOf(o.url) === spec.source ||
          (spec.source === "thm" && sourceOf(o.url) === "jobware"),
        true,
        o.url,
      );
    }
    for (const key of ["title", "company", "location", "url"])
      if (key in spec.first) assert.equal(offers[0][key], spec.first[key], key);
    // Verschiedene Anzeigen behalten verschiedene Kennungen.
    assert.equal(new Set(offers.map((o) => o.externalRef)).size, offers.length);
    // Blättern und Leermeldung (seit 27. November 2026): die Fixture nennt die nächste Seite oder null am Listenende.
    const seiten = SEITEN[spec.source] || {};
    if ("weiter" in spec) assert.equal(seiten.weiter ? seiten.weiter(html, spec.base) : undefined, spec.weiter, "weiter");
    if ("leer" in spec) assert.equal(!!(seiten.leer && seiten.leer(html)), spec.leer, "leer");
  });
}

test("Jede lesbare Plattform kennt Blättern und Leermeldung", () => {
  const ohne = Object.entries(SEITEN)
    .filter(([id, s]) => id !== "indeed" && (typeof s.weiter !== "function" || typeof s.leer !== "function"))
    .map(([id]) => id);
  assert.deepEqual(ohne, []);
});

const stelle = (title, n) => ({
  title,
  company: "Beispiel GmbH",
  location: "35390 Gießen",
  url: "/jobs/beispiel-" + n + "?utm_source=liste",
});
// Echte Jobmensa-Kartenstruktur mit erfundenen Inhalten.
const jobmensaListe = (titel) =>
  "<main>" +
  titel
    .map(
      (t, i) =>
        `<a data-testid="job-offer-item" href="/jobs/beispiel-${i + 1}?utm_source=liste"><h2>${t}</h2><p><svg data-icon="building"></svg>Beispiel GmbH</p><p><svg data-icon="location-dot"></svg>35390 Gießen</p></a>`,
    )
    .join("") +
  "</main>";
const mitNetz = async (antwort, arbeit) => {
  const original = globalThis.fetch;
  globalThis.fetch = antwort;
  try {
    return await arbeit();
  } finally {
    globalThis.fetch = original;
  }
};

test("Rohkarten: nur HTTPS-Anzeigen derselben Quelle, Titel Pflicht, Werbeparameter entfernt, Dubletten zusammengefasst", () => {
  const offers = cardOffers(
    [
      stelle("Werkstudent Data", 1),
      stelle("Werkstudent Data", 1),
      {
        title: "Fremd",
        company: "X",
        url: "https://www.stepstone.de/stellenangebote--1.html",
      },
      { title: "", company: "X", url: "/jobs/leer-2" },
      {
        title: "Werkstudent &amp; IT",
        company: " <b>Firma</b> ",
        url: "http://www.jobmensa.de/jobs/alt-3",
      },
    ],
    "https://www.jobmensa.de/jobs-suchen",
    "jobmensa",
  );
  assert.equal(offers.length, 2);
  assert.equal(offers[0].url, "https://www.jobmensa.de/jobs/beispiel-1");
  assert.equal(offers[0].location, "35390 Gießen");
  assert.equal(
    offers[0].complete,
    false,
    "Eine Karte ohne Beschreibung gilt nie als vollständig",
  );
  assert.equal(offers[1].title, "Werkstudent & IT");
  assert.equal(offers[1].company, "Firma");
  assert(offers[1].url.startsWith("https://"));
});

test("Trefferliste mit Karten: höchstens drei Detailseiten; eine Sperre beendet nur die Ergänzung, nicht die Quelle", async () => {
  const urls = [],
    detail =
      '<script type="application/ld+json">' +
      JSON.stringify({
        "@type": "JobPosting",
        title: "Werkstudent Data",
        hiringOrganization: { name: "Andere Angabe" },
        description: "Datenanalyse mit Python und SQL. ".repeat(10),
      }) +
      "</script>";
  let r = await mitNetz(
    async (url) => {
      urls.push(String(url));
      return new Response(
        urls.length === 1
          ? jobmensaListe([1, 2, 3, 4, 5].map((n) => "Werkstudent Data " + n))
          : detail,
      );
    },
    () => scanPublicSource("jobmensa", "Werkstudent Data", "Gießen", 100),
  );
  assert.equal(urls.length, 4, "Liste plus drei Details");
  assert.equal(r.offers.length, 5);
  assert.equal(r.offers.filter((o) => o.complete).length, 3);
  assert.equal(r.offers[0].company, "Beispiel GmbH", "Kartenangabe hat Vorrang");
  // Eine Liste ohne weitere Seite ist zu Ende gelesen (seit 27. November 2026: „gelesen“ statt Teiltreffer).
  assert.equal(r.report.status, "ok");
  assert.equal(r.report.found, 5);
  assert.equal(r.report.limited, false);
  urls.length = 0;
  r = await mitNetz(
    async (url) => {
      urls.push(String(url));
      return urls.length === 1
        ? new Response(jobmensaListe([1, 2, 3].map((n) => "Werkstudent IT " + n)))
        : new Response("", { status: 403 });
    },
    () => scanPublicSource("jobmensa", "Werkstudent IT", "Gießen", 100),
  );
  assert.equal(urls.length, 2, "Nach der ersten gesperrten Detailseite keine weitere Anfrage");
  assert.equal(r.offers.length, 3);
  assert.equal(r.report.status, "ok", "Gelesene Liste bleibt gültig; eine gesperrte Detailseite ändert den Listenzustand nicht");
});

test("Plattformparser ohne Treffer liefern eine leere Liste statt eines Fehlers", () => {
  for (const id of SOURCE_IDS)
    assert.equal(
      parseOffers(
        "<html><body>Keine Treffer</body></html>",
        "https://www.stepstone.de/",
        id,
      ).length,
      0,
      id,
    );
});

// Blätterschleife mit gekürzten echten Jobmensa-Seiten: Seite 1 nennt die Folgeseite, die letzte Seite keine mehr.
const fixture = (name) => readFileSync(path.join(ordner, name), "utf8");
const pause = async (arbeit) => {
  const original = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => { fn(); return 0; };
  try { return await arbeit(); } finally { globalThis.setTimeout = original; }
};

test("Ganze Trefferliste: alle Seiten bis zum Ende gelesen, Bericht ok statt Teiltreffer", async () => {
  const urls = [];
  const r = await pause(() => mitNetz(
    async (url) => {
      const u = String(url);
      urls.push(u);
      if (u.includes("jobs-suchen")) return new Response(fixture(u.includes("page=2") ? "jobmensa-letzte.html" : "jobmensa-seite1.html"));
      return new Response("", { status: 404 });
    },
    () => scanPublicSource("jobmensa", "Werkstudent Seitenprobe", "Gießen", 100),
  ));
  assert.equal(urls.filter((u) => u.includes("jobs-suchen")).length, 2, "Je Seite genau eine Anfrage");
  assert.equal(r.report.status, "ok");
  assert.equal(r.report.pages, 2);
  assert.equal(r.report.limited, false);
  assert.equal(r.offers.length, 6, "Keine Begrenzung auf eine Seite oder zehn Karten");
  assert.match(r.report.message, /vollständig gelesen: 2 Seiten, 6 Anzeigen/);
});

test("Ausdrücklich leere Liste gilt als gelesen, ohne Folge- oder Detailanfrage", async () => {
  const urls = [];
  const r = await mitNetz(
    async (url) => { urls.push(String(url)); return new Response(fixture("jobmensa-leer.html")); },
    () => scanPublicSource("jobmensa", "Werkstudent Leerprobe", "Gießen", 50),
  );
  assert.equal(r.report.status, "ok");
  assert.equal(r.report.found, 0);
  assert.match(r.report.message, /keine Anzeige/);
  assert.equal(urls.length, 1);
});

test("Gesperrte Folgeseite: gelesene Anzeigen bleiben, Quelle gilt als blockiert", async () => {
  const r = await pause(() => mitNetz(
    async (url) => String(url).includes("page=2") ? new Response("", { status: 429 }) : String(url).includes("jobs-suchen") ? new Response(fixture("jobmensa-seite1.html")) : new Response("", { status: 404 }),
    () => scanPublicSource("jobmensa", "Werkstudent Sperrprobe", "Gießen", 100),
  ));
  assert.equal(r.report.status, "blocked");
  assert.equal(r.offers.length, 3);
});
