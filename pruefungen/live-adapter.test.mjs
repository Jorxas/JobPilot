import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { erstelleServer } from "../dist/server.mjs";
test("Freigeschaltete Live-Adapter arbeiten mit gemockten Quellen, erhalten Fortschritt und vermischen keine Demodaten", async () => {
  const ordner = await mkdtemp(path.join(os.tmpdir(), "jobpilot-live-test-")),
    server = erstelleServer({ datenordner: ordner, live: true });
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
    assert.equal(a.zustand.abfrageIndex, 2);
    assert.equal(a.zustand.stellen.length, 1);
    assert.equal(a.zustand.stellen[0].complete, true);
    assert(!a.zustand.stellen.some((s) => s.company.includes("Morgenrot")));
    assert(a.zustand.berichte.some((r) => r.status === "blocked"));
    assert(abgerufen.length >= 5);
    const id = a.zustand.stellen[0].id;
    assert.equal(
      (await post("/api/status-aendern", { id, status: "applied" })).status,
      200,
    );
    const b = await post("/api/suche", { live: true }).then((r) => r.json());
    assert.equal(b.zustand.stellen[0].status, "applied");
    assert.equal(b.zustand.abfrageIndex, 4);
    assert.equal(
      abgerufen.filter((u) => u.includes("/pc/v4/jobdetails/")).length,
      1,
    );
    const c = await post("/api/suche", { live: false }).then((r) => r.json());
    assert.equal(c.modus, "synthetisch");
    assert(
      !c.zustand.stellen.some(
        (s) => s.company === "Synthetische Adaptertestfirma",
      ),
    );
  } finally {
    globalThis.fetch = client;
    await new Promise((r) => server.close(r));
    await rm(ordner, { recursive: true, force: true });
  }
});
