import { build } from "esbuild";
import { mkdir, cp, writeFile } from "node:fs/promises";
await mkdir("dist/assets", { recursive: true });
await cp("public", "dist", { recursive: true });
await cp('src/kern/LICENSE.JobScout','dist/LICENSE.JobScout');
await cp('src/kern/NOTICE.md','dist/NOTICE.JobScout.md');
// Echte Oberfläche des JobPilot-Leitstands; Schriften liegen unter dist/schriften (relativ zum CSS).
await build({
  entryPoints: ["src/oberflaeche/haupt.tsx"],
  bundle: true,
  minify: true,
  sourcemap: false,
  format: "esm",
  target: "es2022",
  outfile: "dist/assets/app.js",
  external: ["../schriften/*"],
  define: { "process.env.NODE_ENV": '"production"' },
});
// Demo-Daten und Hinweise, vor der Oberfläche geladen (ersetzt nur die Serveranfragen durch erfundene Daten).
await build({
  entryPoints: ["src/oberflaeche/demo-start.ts"],
  bundle: true,
  minify: true,
  sourcemap: false,
  format: "iife",
  target: "es2022",
  outfile: "dist/assets/demo.js",
});
// Lokaler Server und prüfbare Node-Module. Sie gehören nicht zum statischen Export (Positivliste im README).
const nodeModule = {
  "src/oberflaeche/suchtag.ts": "dist/suchtag.mjs",
  "src/server.ts": "dist/server.mjs",
  "src/ablauf.ts": "dist/ablauf.mjs",
  "src/kern/public.ts": "dist/quellen.mjs",
  "src/kern/karten.ts": "dist/karten.mjs",
  "src/kern/nachweise.ts": "dist/nachweise.mjs",
  "src/arbeitgeber.ts": "dist/arbeitgeber.mjs",
  "src/kern/platforms.ts": "dist/plattformen.mjs",
  "src/kern/platform-status.ts": "dist/plattformstatus.mjs",
  "src/kern/scope.ts": "dist/umkreis.mjs",
  "src/kern/indeed-claude.ts": "dist/indeed-claude.mjs",
  "src/kern/indeed-codex.ts": "dist/indeed-codex.mjs",
  "src/kern/indeed-connectors.ts": "dist/indeed-connectors.mjs",
  "src/kern/indeed-ts-jobspy.ts": "dist/indeed-ts-jobspy.mjs",
  "src/geokodierung.ts": "dist/geokodierung.mjs",
  // Archivgründe, Firmenausschluss und Firmenregeln des Kerns sowie der Ablauf des Suchknopfs (für die Prüfungen).
  "src/archiv.ts": "dist/archiv.mjs",
  "src/kern/company-catalogue.ts": "dist/firmen.mjs",
  "src/oberflaeche/suchablauf.ts": "dist/suchablauf.mjs",
  // Automatische Bewerbungsunterlagen: Vorlage, PDF-Schreiber und KI-Wege (für pruefungen/unterlagen.test.mjs).
  "src/unterlagen-erzeugen.ts": "dist/unterlagen.mjs",
};
for (const [quelle, ziel] of Object.entries(nodeModule))
  await build({
    entryPoints: [quelle],
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node22",
    outfile: ziel,
  });
await writeFile("dist/.nojekyll", "");
console.log("Browser-Demo, lokaler Server und prüfbarer Suchkern gebaut.");
