import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
const verboteneNamen =
  /^(?:\.env(?:\..+)?|ACCESS\.md|form-profile\.local\.json|tracker-items\.json|tracker-contacts\.local\.json)$/i;
const muster = [
  /-----BEGIN [^-]*PRIVATE KEY-----/,
  /\bghp_[A-Za-z0-9]{20,}/,
  /\bgithub_pat_[A-Za-z0-9_]{25,}/,
  /\bsk-(?:ant-)?[A-Za-z0-9_-]{30,}/,
  /postgres(?:ql)?:\/\/[^\s"']+:[^\s"']+@/,
  /\b[A-Za-z0-9._%+-]+@(?:gmail|outlook|hotmail)\.[A-Za-z]+/i,
  /C:\\\\Users\\\\/i,
  /tail[0-9a-f]+\.ts\.net/i,
];
const fehler = [];
let zahl = 0;
async function pruefen(ordner) {
  for (const e of await readdir(ordner, { withFileTypes: true })) {
    if (
      [".git", "node_modules", "dist", "daten", ".nachweise"].includes(e.name)
    )
      continue;
    const p = path.join(ordner, e.name);
    if (e.isDirectory()) {
      await pruefen(p);
      continue;
    }
    zahl++;
    if (
      (verboteneNamen.test(e.name) && e.name !== ".env.example") ||
      /\.(?:pdf|eml|db|sqlite|zip)$/i.test(e.name)
    )
      fehler.push(p + ": unzulässiger Laufzeit-/Privatdateityp");
    if (/\.(?:[cm]?[jt]sx?|jsonl?|html|css|md|ya?ml|txt)$/.test(e.name)) {
      const text = await readFile(p, "utf8");
      for (const m of muster)
        if (m.test(text))
          fehler.push(
            p + ": mögliches privates Muster (Wert nicht ausgegeben)",
          );
    }
  }
}
await pruefen(".");
if (fehler.length) {
  console.error([...new Set(fehler)].join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `${zahl} Quelldateien geprüft: keine erkannten privaten Profile, Dokumente oder Zugangsdatenmuster.`,
  );
