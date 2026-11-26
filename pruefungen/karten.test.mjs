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
  });
}

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
  assert.equal(r.report.status, "partial");
  assert.equal(r.report.found, 5);
  assert.equal(r.report.limited, true);
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
  assert.equal(r.report.status, "partial", "Gelesene Liste bleibt gültig");
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
