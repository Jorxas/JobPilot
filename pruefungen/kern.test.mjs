import { test } from "node:test";
import assert from "node:assert/strict";
import {
  aufnehmen,
  batchPlan,
  bewerten,
  firmenansicht,
  searchPlan,
  SEARCH_PASSES,
  TECH_FAMILIES,
  pruefeManuellenImport,
} from "../dist/ablauf.mjs";
import {
  allowedUrl,
  structuredOffers,
  scanPublicSource,
} from "../dist/quellen.mjs";
const profil = {
  skills: ["Java", "SQL", "React"],
  anchoredSkills: ["Java"],
  keywords: "Werkstudent Java",
  englishBasic: true,
};
const angebot = (id, extra = {}) => ({
  source: "linkedin",
  externalRef: id,
  title: "Werkstudent Java",
  company: "Musterwerk GmbH",
  location: "Gießen",
  description: "Java, SQL und React. ".repeat(12),
  url: "https://www.linkedin.com/jobs/view/1234567890",
  complete: true,
  ...extra,
});
test("25 Themenfelder sind über fünf Durchläufe abgedeckt; Kenntnisse begrenzen den Suchraum nicht", () => {
  const felder = new Set();
  for (let r = 0; r < SEARCH_PASSES; r++)
    for (const q of searchPlan("Werkstudent Java", true, r))
      felder.add(q.family);
  assert.equal(SEARCH_PASSES, 5);
  assert.equal(TECH_FAMILIES.length, 25);
  for (const f of TECH_FAMILIES) assert(felder.has(f.id));
});
test("Spurplan: jede Plattform erhält je Durchlauf genau eine Anfrage, fünf verschiedene je Suchstart", () => {
  const liste = ["Werkstudent IT", "Werkstudent Data", "Praktikum Informatik", "Werkstudent Cloud", "Werkstudent QA", "Werkstudent SAP", "Werkstudent KI"];
  for (const breit of [true, false])
    for (const begriffe of [liste, liste.slice(0, 2), []]) {
      if (!breit && !begriffe.length) continue;
      const plan = batchPlan(begriffe, breit, 0, 21);
      assert.equal(plan.length, 5);
      for (let spur = 0; spur < 21; spur++) {
        const je = plan.map((p) => p.lanes[spur]?.keywords.toLowerCase());
        assert(je.every(Boolean), "eine Anfrage je Durchlauf");
        assert.equal(new Set(je).size, 5, "fünf verschiedene Begriffe");
      }
    }
  // Verschiedene Plattformen erhalten im selben Durchlauf verschiedene Begriffe; über Suchstarte rotiert die Liste.
  const a = batchPlan(liste, true, 0, 3), b = batchPlan(liste, true, 5, 3);
  assert.notEqual(a[0].lanes[0].keywords, a[0].lanes[1].keywords);
  assert.notEqual(a[0].lanes[0].keywords, b[0].lanes[0].keywords);
});
test("Reihenfolge und Wiederholung erhalten eine beworbene Firmenhistorie", () => {
  const alt = { ...angebot("alt"), id: "alt", status: "applied", score: 10 };
  const r = aufnehmen(
    [alt],
    [angebot("neu", { source: "stepstone", company: "Musterwerk" })],
    profil,
  );
  assert.equal(r.neu, 0);
  assert.equal(r.doppelt, 1);
  assert.equal(r.stellen[0].status, "applied");
  assert.equal(
    aufnehmen(r.stellen, [angebot("neu")], profil).stellen.length,
    1,
  );
});
test("Senior- und fachfremde Angebote werden abgewiesen; andere Technologien bleiben", () => {
  const r = aufnehmen(
    [],
    [
      angebot("1", { title: "Senior Java Developer" }),
      angebot("2", { title: "Werkstudent Verkauf" }),
      angebot("3", {
        title: "Werkstudent C++ Embedded",
        description: "C++ und Mikrocontroller",
      }),
    ],
    profil,
  );
  assert.equal(r.ausgeschlossen, 2);
  assert.equal(r.neu, 1);
  assert.equal(r.stellen[0].title, "Werkstudent C++ Embedded");
});
test("Fachlich identische Stellen in unterschiedlichen Orten bleiben als Datensätze erhalten", () => {
  const r = aufnehmen(
    [],
    [angebot("1"), angebot("2", { location: "Marburg" })],
    profil,
  );
  assert.equal(r.neu, 2);
  assert.equal(firmenansicht(r.stellen).length, 1);
});
test("Die Heuristik reagiert auf Profiländerungen; fehlende Beschreibung bleibt erkennbar", () => {
  const r = aufnehmen([], [angebot("1", { complete: false })], profil);
  const a = bewerten(r.stellen, profil),
    b = bewerten(r.stellen, { ...profil, skills: [] });
  assert(a[0].score > b[0].score);
  assert(a[0].warnings.length > 0);
});
test("Manueller Import akzeptiert HTTPS und lehnt Skripte, Zugangsdaten und fehlende Titel ab", () => {
  const d = angebot("1");
  assert.equal(pruefeManuellenImport(d).complete, true);
  for (const url of [
    "javascript:alert(1)",
    "http://example.test",
    "https://user:password@example.test",
  ])
    assert.throws(() => pruefeManuellenImport({ ...d, url }));
  assert.throws(() => pruefeManuellenImport({ ...d, title: "" }));
});
test("Öffentlicher URL-Import bleibt auf erlaubte HTTPS-Quellen begrenzt", () => {
  for (const u of [
    "http://de.indeed.com/jobs",
    "https://127.0.0.1",
    "https://de.indeed.com.evil.test",
    "https://user:password@de.indeed.com/jobs",
    "https://de.indeed.com:8443/jobs",
  ])
    assert.throws(() => allowedUrl(u));
});
test("JSON-LD-Import trennt gültige, abgelaufene und ausländische Ausschreibungen", () => {
  const job = {
    ...angebot("1"),
    "@type": "JobPosting",
    hiringOrganization: { name: "Musterwerk" },
    jobLocation: {
      address: { addressLocality: "Gießen", addressCountry: "DE" },
    },
  };
  const html =
    '<script type="application/ld+json">' +
    JSON.stringify({
      "@graph": [
        job,
        { ...job, validThrough: "2000-01-01" },
        { ...job, jobLocation: { address: { addressCountry: "US" } } },
      ],
    }) +
    "</script>";
  const r = structuredOffers(html, job.url, "linkedin");
  assert.equal(r.length, 1);
  assert.equal(r[0].company, "Musterwerk");
});
test("HTTP-Blockade wird sichtbar und innerhalb des Quellencaches nicht wiederholt", async () => {
  const original = globalThis.fetch;
  let aufrufe = 0;
  globalThis.fetch = async () => {
    aufrufe++;
    return new Response("", { status: 403 });
  };
  try {
    const a = await scanPublicSource(
        "stepstone",
        "synthetischer-test",
        "Musterstadt",
        25,
      ),
      b = await scanPublicSource(
        "stepstone",
        "synthetischer-test",
        "Musterstadt",
        25,
      );
    assert.equal(a.report.status, "blocked");
    assert.equal(b.report.status, "blocked");
    assert.equal(aufrufe, 1);
    // Indeed sperrt technisch (Cloudflare): ohne Claude-Connector wird gar keine Anfrage gesendet.
    const c = await scanPublicSource("indeed", "synthetischer-test", "Musterstadt", 25);
    assert.equal(c.report.status, "blocked");
    assert.match(c.report.message, /Keine Anfrage gesendet/);
    assert.equal(aufrufe, 1);
  } finally {
    globalThis.fetch = original;
  }
});
