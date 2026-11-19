import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createHash } from "node:crypto";
import { textOnly, type Offer, type SourceReport } from "./kern/core";
export type Arbeitgeber = { name: string; url: string };
export function privateAdresse(ip: string) {
  return (
    ip === "::1" ||
    ip === "::" ||
    /^f[cd]|^fe[89ab]/i.test(ip) ||
    ip.includes("::ffff:") ||
    /^(?:0\.|10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|198\.(?:18|19)\.|22[4-9]\.|23\d\.|24\d\.)/.test(
      ip,
    )
  );
}
export async function pruefeArbeitgeberUrl(
  raw: string,
  aufloesen: typeof lookup = lookup,
) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    isIP(u.hostname) ||
    !u.hostname.includes(".") ||
    u.hostname.endsWith(".local") ||
    u.hostname === "localhost"
  )
    throw Error(
      "Nur öffentliche Arbeitgeber-HTTPS-Adressen ohne Zugangsdaten sind erlaubt.",
    );
  const adressen = await aufloesen(u.hostname, { all: true });
  if (!adressen.length || adressen.some((a) => privateAdresse(a.address)))
    throw Error("Lokale oder interne Netzwerkadressen sind ausgeschlossen.");
  return u;
}
export function arbeitgeberAngebote(
  html: string,
  basis: string,
  name: string,
  jetzt = new Date(),
): Offer[] {
  const ausgabe: Offer[] = [];
  const url = new URL(basis);
  function lesen(v: unknown, tiefe = 0) {
    if (tiefe > 25 || !v || typeof v !== "object") return;
    if (Array.isArray(v)) {
      v.forEach((x) => lesen(x, tiefe + 1));
      return;
    }
    const d = v as Record<string, any>;
    if ([d["@type"]].flat().includes("JobPosting")) {
      if (
        typeof d.title !== "string" ||
        (d.validThrough && Date.parse(d.validThrough) < jetzt.getTime())
      )
        return;
      const ort = Array.isArray(d.jobLocation)
        ? d.jobLocation[0]
        : d.jobLocation;
      const adresse = ort?.address || {};
      const land =
        typeof adresse.addressCountry === "string"
          ? adresse.addressCountry
          : adresse.addressCountry?.name;
      if (land && !/^(de|deu|deutschland|germany)$/i.test(land)) return;
      let ziel: URL;
      try {
        ziel = new URL(typeof d.url === "string" ? d.url : basis, basis);
      } catch {
        return;
      }
      if (
        ziel.protocol !== "https:" ||
        ziel.hostname !== url.hostname ||
        ziel.username ||
        ziel.password
      )
        return;
      const beschreibung = textOnly(String(d.description || ""));
      ausgabe.push({
        source: "arbeitgeber",
        externalRef: createHash("sha256")
          .update(ziel.href + "|" + d.title)
          .digest("hex")
          .slice(0, 24),
        title: textOnly(d.title),
        company:
          typeof d.hiringOrganization?.name === "string"
            ? textOnly(d.hiringOrganization.name)
            : name,
        description: beschreibung,
        complete: beschreibung.length >= 150,
        location:
          [adresse.postalCode, adresse.addressLocality]
            .filter(Boolean)
            .join(" ") || null,
        url: ziel.href,
      });
      return;
    }
    for (const wert of Object.values(d)) lesen(wert, tiefe + 1);
  }
  for (const m of html.matchAll(
    /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      lesen(JSON.parse(m[1]));
    } catch {}
  }
  return [...new Map(ausgabe.map((o) => [o.externalRef, o])).values()];
}
export async function arbeitgeberLesen(
  eintrag: Arbeitgeber,
): Promise<{ offers: Offer[]; report: SourceReport }> {
  let basis = eintrag.url;
  try {
    const u = await pruefeArbeitgeberUrl(eintrag.url);
    const r = await fetch(u, {
      redirect: "manual",
      headers: { "User-Agent": "JobPilot public career reader" },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok)
      return {
        offers: [],
        report: {
          source: "arbeitgeber",
          status: [401, 403, 429].includes(r.status) ? "blocked" : "error",
          found: 0,
          inserted: 0,
          message:
            "Arbeitgeberseite nicht öffentlich lesbar; manuelle Prüfung erforderlich.",
          searchUrl: basis,
        },
      };
    const reader = r.body?.getReader();
    if (!reader) throw Error("Leere Antwort");
    const teile: Uint8Array[] = [];
    let groesse = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      groesse += value.length;
      if (groesse > 3 * 1024 * 1024) {
        await reader.cancel();
        throw Error("Seite zu groß");
      }
      teile.push(value);
    }
    const html = Buffer.concat(teile).toString("utf8");
    if (
      /verify you are human|<title>[^<]*(?:captcha|just a moment|sign in)/i.test(
        html,
      )
    )
      return {
        offers: [],
        report: {
          source: "arbeitgeber",
          status: "blocked",
          found: 0,
          inserted: 0,
          message: "Zugriffsprüfung erkannt; kein Umgehen.",
          searchUrl: basis,
        },
      };
    const offers = arbeitgeberAngebote(html, u.href, eintrag.name);
    return {
      offers,
      report: {
        source: "arbeitgeber",
        status: offers.length ? "ok" : "partial",
        found: offers.length,
        inserted: 0,
        message: offers.length
          ? "Strukturierte Arbeitgeberanzeigen gelesen."
          : "Keine verlässlich lesbaren JobPosting-Daten; Seite manuell prüfen.",
        searchUrl: basis,
      },
    };
  } catch {
    return {
      offers: [],
      report: {
        source: "arbeitgeber",
        status: "error",
        found: 0,
        inserted: 0,
        message:
          "Arbeitgeberquelle nicht verfügbar oder URL nicht freigegeben.",
        searchUrl: basis,
      },
    };
  }
}
