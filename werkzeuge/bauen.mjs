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
await build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "dist/server.mjs",
});
await build({
  entryPoints: ["src/ablauf.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "dist/ablauf.mjs",
});
await build({
  entryPoints: ["src/kern/public.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "dist/quellen.mjs",
});
await writeFile("dist/.nojekyll", "");
await build({
  entryPoints: ["src/arbeitgeber.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "dist/arbeitgeber.mjs",
});
console.log("Browser-Demo, lokaler Server und prüfbarer Suchkern gebaut.");
