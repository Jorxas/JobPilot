import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { erstelleServer } from "../dist/server.mjs";
test("Freigeschaltete Live-Adapter arbeiten mit gemockten Quellen, erhalten Fortschritt und vermischen keine Demodaten", async () => {
  const ordner = await mkdtemp(path.join(os.tmpdir(), "jobpilot-live-test-")),
    server = erstelleServer({
      datenordner: ordner,
      live: true,
      indeedClaude: { verfuegbar: false },
    });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const basis = "http://127.0.0.1:" + server.address().port;
  const client = globalThis.fetch,
    abgerufen = [];
  globalThis.fetch = async (input) => {
    const u = String(input);
    abgerufen.push(u);
    if (u.includes("/pc/v4/jobdetails/"))
      return Response.json({
        referenznummer: "LIVE-TEST",
        stellenangebotsTitel: "Werkstudent Informatik",
        firma: "Synthetische Adaptertestfirma",
        stellenangebotsBeschreibung:
          "Java, SQL und Informatik im synthetischen Adaptertest. ".repeat(8),
      });
    if (u.startsWith("https://rest.arbeitsagentur.de/"))
      return Response.json({
        ergebnisliste: [
          {
            referenznummer: "LIVE-TEST",
            stellenangebotsTitel: "Werkstudent Informatik",
            firma: "Synthetische Adaptertestfirma",
            stellenlokationen: [{ adresse: { ort: "Gießen" } }],
          },
        ],
      });
    return new Response("", { status: 403 });
  };
  const post = (pfad, d) =>
    client(basis + pfad, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    });
  try {
    const a = await post("/api/suche", { live: true }).then((r) => r.json());
    assert.equal(a.modus, "live");
    // Ein Suchstart = fünf Durchläufe über alle 18 Plattformen.
    assert.equal(a.zustand.runde, 5);
    assert.equal(a.zustand.lauf.zustand, "fertig");
    assert.equal(a.zustand.lauf.abgeschlossen, 5);
    assert.equal(a.zustand.quellen.length, 18);
    assert.equal(a.plan.length, 5);
    for (const p of a.plan) assert.equal(p.anfragen.length, 18, "Eine Anfrage je Plattform und Durchlauf");
    assert.equal(a.zustand.stellen.length, 1);
    assert.equal(a.zustand.stellen[0].complete, true);
    assert(!a.zustand.stellen.some((s) => s.company.includes("Morgenrot")));
    const berichte = a.zustand.berichte;
    assert.equal(berichte.filter((r) => r.source === "bundesagentur").length, 5);
    // Gesperrte Quellen: eine Anfrage, danach im selben Suchstart übersprungen; nie als vollständig ausgewiesen.
    const stepstone = berichte.filter((r) => r.source === "stepstone");
    assert.equal(stepstone.length, 5);
    assert.equal(stepstone[0].status, "blocked");
    assert.equal(stepstone.filter((r) => r.skipped).length, 4);
    assert.equal(abgerufen.filter((u) => u.includes("stepstone.de")).length, 1);
    // Technisch gesperrte Quellen erhalten nie eine Anfrage.
    for (const host of ["indeed.com", "jobvector.de", "heyjobs.co", "stwgi.de"])
      assert(!abgerufen.some((u) => u.includes(host)), host);
    assert(berichte.every((r) => r.source === "bundesagentur" || r.status !== "ok"));
    const id = a.zustand.stellen[0].id;
    assert.equal(
      (await post("/api/status-aendern", { id, status: "applied" })).status,
      200,
    );
    const b = await post("/api/suche", { live: true }).then((r) => r.json());
    assert.equal(b.zustand.stellen[0].status, "applied");
    assert.equal(b.zustand.runde, 10, "Rotation läuft über Suchstarts weiter");
    assert.equal(
      abgerufen.filter((u) => u.includes("/pc/v4/jobdetails/")).length,
      1,
    );
    // Abwahl: nur noch die gewählten Plattformen; leere Auswahl wird abgelehnt.
    abgerufen.length = 0;
    const c = await post("/api/suche", { live: true, quellen: ["bundesagentur"] }).then((r) => r.json());
    assert.deepEqual(c.zustand.quellen, ["bundesagentur"]);
    assert(c.zustand.berichte.every((r) => r.source === "bundesagentur"));
    assert(abgerufen.every((u) => u.startsWith("https://rest.arbeitsagentur.de/")));
    assert.equal((await post("/api/suche", { live: true, quellen: [] })).status, 400);
    // Hintergrundlauf: sofortige Antwort, Fortschritt über /api/status, Sperre bis zum Ende.
    const start = await post("/api/suche", { live: true, quellen: ["bundesagentur"], hintergrund: true });
    assert.equal(start.status, 202);
    assert.equal((await start.json()).zustand.lauf.zustand, "laeuft");
    assert.equal((await post("/api/suche", { live: true })).status, 409);
    await server.suchlauf();
    const status = await client(basis + "/api/status").then((r) => r.json());
    assert.equal(status.zustand.lauf.zustand, "fertig");
    const d = await post("/api/suche", { live: false }).then((r) => r.json());
    assert.equal(d.modus, "synthetisch");
    assert(
      !d.zustand.stellen.some(
        (s) => s.company === "Synthetische Adaptertestfirma",
      ),
    );
  } finally {
    globalThis.fetch = client;
    await new Promise((r) => server.close(r));
    await rm(ordner, { recursive: true, force: true });
  }
});
