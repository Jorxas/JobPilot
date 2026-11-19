import { test } from "node:test";
import assert from "node:assert/strict";
import {
  arbeitgeberAngebote,
  privateAdresse,
  pruefeArbeitgeberUrl,
} from "../dist/arbeitgeber.mjs";
test("Arbeitgeberimport liest dieselbe Domain und kennzeichnet unvollständige Beschreibungen", () => {
  const job = {
    "@type": "JobPosting",
    title: "Werkstudent Informatik",
    url: "https://karriere.example.test/stelle",
    description: "Kurzer Text",
    hiringOrganization: { name: "Musterfirma" },
    jobLocation: { address: { addressCountry: "DE" } },
  };
  const html =
    '<script type="application/ld+json">' +
    JSON.stringify({
      "@graph": [job, { ...job, url: "https://fremd.example.test/stelle" }],
    }) +
    "</script>";
  const r = arbeitgeberAngebote(
    html,
    "https://karriere.example.test/",
    "Musterfirma",
  );
  assert.equal(r.length, 1);
  assert.equal(r[0].source, "arbeitgeber");
  assert.equal(r[0].complete, false);
});
test("Arbeitgeber-URL und DNS-Prüfung lehnen interne Ziele ab", async () => {
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.100.1.1",
    "::1",
    "fc00::1",
    "fe80::1",
  ])
    assert(privateAdresse(ip), ip);
  for (const url of [
    "http://example.test",
    "https://127.0.0.1",
    "https://localhost",
    "https://user:password@example.test",
  ])
    await assert.rejects(() => pruefeArbeitgeberUrl(url));
  await assert.rejects(() =>
    pruefeArbeitgeberUrl("https://karriere.example.test", async () => [
      { address: "10.0.0.1", family: 4 },
    ]),
  );
  const u = await pruefeArbeitgeberUrl(
    "https://karriere.example.test/jobs",
    async () => [{ address: "203.0.113.1", family: 4 }],
  );
  assert.equal(u.hostname, "karriere.example.test");
});
