// Gemeinsame Werkzeuge für plattformspezifische Trefferlisten (karten-<plattform>.ts).
// Ein Parser liefert nur, was die Antwort tatsächlich enthält; public.ts prüft Adresse, Quelle und Kennung.
import { textOnly } from "./core";

export type Karte = {
  title: string;
  company?: string | null;
  // Postleitzahl und Ort, wenn vorhanden: die Umkreisprüfung kennt vor allem Postleitzahlen.
  location?: string | null;
  url: string;
  publishedAt?: string;
  description?: string;
};
export type KartenParser = (html: string, base: string) => Karte[];
// Blättern und ausdrückliche Leermeldung je Plattform (seit 27. November 2026, siehe scanPublicSource in public.ts).
// weiter: Adresse der nächsten Seite derselben Trefferliste oder null, wenn diese Seite nachweislich die letzte ist.
// leer: die Seite meldet ausdrücklich, dass es zu dieser Suche keine Anzeige gibt (z. B. „0 Jobs“).
// Ohne weiter kann JobPilot das Ende der Liste nicht bestätigen; die Quelle bleibt dann „teilweise“.
// kopfzeilen: zusätzliche Kopfzeilen, die die eigene Liste der Seite für Folgeseiten verlangt (z. B. get in IT:
// X-Requested-With); die ehrliche Kennung (User-Agent) bleibt immer unverändert.
export type Seiten = {
  weiter?: (html: string, base: string) => string | null;
  leer?: (html: string) => boolean;
  kopfzeilen?: (url: string) => Record<string, string> | undefined;
};
export type ListenModul = { karten: KartenParser } & Seiten;

export const text = (html: string | null | undefined) => (html ? textOnly(html) : "");

// Wert eines HTML-Attributs in einem Tag-Ausschnitt, Entitäten aufgelöst.
export function attr(fragment: string, name: string): string {
  const m = fragment.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return m ? textOnly(m[1] ?? m[2] ?? "") : "";
}

// Innerer Text des ersten Elements, dessen class-Attribut den Ausdruck enthält.
export function byClass(html: string, cls: string, tag = "[a-z0-9]+"): string {
  return textOnly(html.match(new RegExp(`<(${tag})\\b[^>]*class=["'][^"']*${cls}[^"']*["'][^>]*>([\\s\\S]*?)<\\/\\1>`, "i"))?.[2] || "");
}

// Teilt eine Liste an jedem Öffnungstag, das zum Ausdruck passt; das erste Stück (vor der ersten Karte) entfällt.
export function cards(html: string, opening: RegExp): string[] {
  const flags = opening.flags.includes("g") ? opening.flags : opening.flags + "g";
  const re = new RegExp(opening.source, flags), starts: number[] = [];
  for (const m of html.matchAll(re)) starts.push(m.index!);
  return starts.map((s, i) => html.slice(s, starts[i + 1] ?? html.length));
}

// JSON aus <script id="..."> (z. B. __NEXT_DATA__) oder aus einer Zuweisung wie window.__STATE__ = {...};
export function jsonScript(html: string, id: string): unknown {
  const m = html.match(new RegExp(`<script\\b[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`, "i"));
  if (!m) return undefined;
  try { return JSON.parse(m[1]); } catch { return undefined; }
}
export function jsonAssignment(html: string, name: string): unknown {
  const at = html.indexOf(name);
  if (at < 0) return undefined;
  const start = html.indexOf("{", at);
  if (start < 0) return undefined;
  let depth = 0, inString = false, escaped = false;
  for (let i = start; i < html.length; i++) {
    const c = html[i];
    if (inString) { if (escaped) escaped = false; else if (c === "\\") escaped = true; else if (c === '"') inString = false; continue; }
    if (c === '"') inString = true;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) { try { return JSON.parse(html.slice(start, i + 1)); } catch { return undefined; } }
  }
  return undefined;
}

// Alle Objekte eines JSON-Baums, die das Prädikat erfüllen (ohne in Treffer weiter abzusteigen).
export function findObjects(value: unknown, match: (o: Record<string, unknown>) => boolean, depth = 0, out: Record<string, unknown>[] = []): Record<string, unknown>[] {
  if (depth > 40 || !value || typeof value !== "object") return out;
  if (Array.isArray(value)) { for (const v of value) findObjects(v, match, depth + 1, out); return out; }
  const o = value as Record<string, unknown>;
  if (match(o)) { out.push(o); return out; }
  for (const v of Object.values(o)) findObjects(v, match, depth + 1, out);
  return out;
}

export const str = (v: unknown) => (typeof v === "string" ? textOnly(v) : typeof v === "number" ? String(v) : "");
