// Trefferliste von Jobs in Mittelhessen (Kimeta-Mandant, Next.js). Die Stadtlisten /werkstudent/<ort> und /praktikum/<ort>
// tragen die Treffer in __NEXT_DATA__ unter props.pageProps.__PPA__: das JSON der Seiteneigenschaften als Liste von
// UTF-16-Zeichencodes, darin searchResults.jobOffers mit documentId, title, companyName und location. Die Anzeige liegt
// unter /job?id=<documentId>. Ersatz bei geändertem Payload: die gerenderten Karten (<li data-id=...>, h2, Firma, „loc“).
// Die Stadtlisten kennen weder Suchbegriffe noch Umkreis (fest 0 km) noch Seiten und zeigen höchstens 14 Treffer;
// Abfrageparameter (geprüft: r, page) leiten auf /jobs/<ort> ohne Vertragsfilter um. /search steht hinter einer Anubis-Prüfung.
// Die Detailseite hat kein JSON-LD; anzeige() liest Firma, Ort und Volltext aus ihrem React-Server-Payload.
import { cards, findObjects, jsonAssignment, jsonScript, str, text, type Karte } from "./karten-hilfe";

type J = Record<string, unknown>;
const o = (v: unknown): J => (v && typeof v === "object" && !Array.isArray(v) ? v as J : {});
const key = (s: string) => s.toLocaleLowerCase("de-DE").replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");

// Ort als „PLZ Ort“: „Gießen, HE, DE, 35398“ wird „35398 Gießen“; bei mehreren Orten der gesuchte zuerst, höchstens drei.
function ort(raw: string, stadt: string): string | null {
  const s = raw.replace(/,\s*(?:Deutschland|Germany|DE)\s*$/i, "").trim();
  const umgestellt = s.match(/^([^,\d]+),\s*[A-Z]{2},\s*DE,\s*(\d{5})$/);
  if (umgestellt) return `${umgestellt[2]} ${umgestellt[1].trim()}`;
  const paare = [...s.matchAll(/\b(\d{5})\s+([^,;\d]+)/g)].map(m => `${m[1]} ${m[2].trim()}`);
  if (paare.length < 2) return s || null;
  return paare.sort((a, b) => Number(key(b).includes(stadt)) - Number(key(a).includes(stadt))).slice(0, 3).join("; ");
}

function ausPayload(html: string, stadt: string): Karte[] {
  const props = o(o(o(jsonScript(html, "__NEXT_DATA__")).props).pageProps), codes = props.__PPA__;
  let daten: unknown = props;
  if (Array.isArray(codes)) {
    let s = "";
    for (let i = 0; i < codes.length; i += 8192) s += String.fromCharCode(...codes.slice(i, i + 8192).map(Number));
    daten = JSON.parse(s);
  }
  const liste = o(o(daten).searchResults).jobOffers;
  return findObjects(Array.isArray(liste) ? liste : daten, x => /^\d{6,}$/.test(str(x.documentId)) && typeof x.title === "string").map(a => ({
    title: str(a.title),
    company: a.hasChiffre === true ? null : str(a.companyName) || null,
    location: ort(str(a.location), stadt),
    url: "/job?id=" + str(a.documentId),
    publishedAt: /^\d{4}-\d\d-\d\d/.test(str(a.firstFound)) ? str(a.firstFound).slice(0, 10) : undefined,
  }));
}

function ausKarten(html: string, stadt: string): Karte[] {
  return cards(html, /<li\b[^>]*\bdata-id=["']\d{6,}["'][^>]*data-testid=["']joblist-job-/i).map(card => ({
    title: text(card.match(/<h2\b[^>]*>([\s\S]*?)<\/h2>/i)?.[1]),
    company: text(card.match(/<\/h2>\s*<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1]) || null,
    location: ort(text(card.match(/class=["'][^"']*\bloc\b[^"']*["'][^>]*>[\s\S]*?<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1]), stadt),
    url: "/job?id=" + card.match(/\bdata-id=["'](\d+)/i)![1],
  })).filter(k => k.title);
}

export function karten(html: string, base: string): Karte[] {
  let stadt = "";
  try { stadt = key(decodeURIComponent(new URL(base).pathname.split("/").filter(Boolean).pop() || "").replace(/^.*-in-/, "")); } catch { /* ohne Stadt keine Sortierung */ }
  try { const own = ausPayload(html, stadt); if (own.length) return own; } catch { /* Ersatz unten */ }
  try { return ausKarten(html, stadt); } catch { return []; }
}

// Detailseite /job?id=<nummer> (App Router): jobOffer im React-Server-Payload, der Volltext als Textzeile „<id>:T<länge>,“.
export function anzeige(html: string, url: string): (Karte & { description: string }) | null {
  try {
    let rsc = "", at = 0;
    const push = "self.__next_f.push(";
    while ((at = html.indexOf(push, at)) >= 0) {
      const end = html.indexOf("</script>", at);
      if (end < 0) break;
      try { const c = JSON.parse(html.slice(at + push.length, html.lastIndexOf(")", end))); if (Array.isArray(c) && c[0] === 1 && typeof c[1] === "string") rsc += c[1]; } catch { /* Teilstück überspringen */ }
      at = end;
    }
    const job = o(jsonAssignment(rsc, '"jobOffer":{')), roh = typeof job.offerContent === "string" ? job.offerContent : "";
    const verweis = roh.match(/^\$([0-9a-f]+)$/)?.[1];
    let inhalt = roh;
    if (verweis) {
      const kopf = rsc.match(new RegExp(`(?:^|\\n)${verweis}:T([0-9a-f]+),`));
      inhalt = kopf ? Buffer.from(rsc.slice(kopf.index! + kopf[0].length), "utf8").subarray(0, parseInt(kopf[1], 16)).toString("utf8") : "";
    }
    const sitz = (Array.isArray(job.customerOperatingSites) ? job.customerOperatingSites : []).map(o).find(x => /^\d{5}$/.test(str(x.zipCode)));
    const title = str(job.title), description = text(inhalt);
    if (!title || !description) return null;
    return { title, description, url, company: str(job.companyName) || null, location: sitz ? `${str(sitz.zipCode)} ${str(sitz.city)}` : str(job.location) || null, publishedAt: str(job.firstFound).slice(0, 10) || undefined };
  } catch { return null; }
}
