import { build } from "esbuild";
import { mkdir, cp, writeFile } from "node:fs/promises";
await mkdir("dist/assets", { recursive: true });
await cp("public", "dist", { recursive: true });
await cp('src/kern/LICENSE.JobScout','dist/LICENSE.JobScout');
await cp('src/kern/NOTICE.md','dist/NOTICE.JobScout.md');
await build({
  entryPoints: ["src/app.tsx"],
  bundle: true,
  minify: true,
  sourcemap: false,
  format: "esm",
  target: "es2022",
  outfile: "dist/assets/app.js",
  define: { "process.env.NODE_ENV": '"production"' },
});
// Lokaler Server und prüfbare Node-Module. Sie gehören nicht zum statischen Export (Positivliste im README).
const nodeModule = {
  "src/server.ts": "dist/server.mjs",
  "src/ablauf.ts": "dist/ablauf.mjs",
  "src/kern/public.ts": "dist/quellen.mjs",
  "src/arbeitgeber.ts": "dist/arbeitgeber.mjs",
  "src/kern/platforms.ts": "dist/plattformen.mjs",
  "src/kern/platform-status.ts": "dist/plattformstatus.mjs",
  "src/kern/scope.ts": "dist/umkreis.mjs",
  "src/kern/indeed-claude.ts": "dist/indeed-claude.mjs",
  "src/geokodierung.ts": "dist/geokodierung.mjs",
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
