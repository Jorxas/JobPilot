import { normalize, eligibleRole, classifyContract, type Offer } from "./core";
type Point = { lat: number; lon: number };
export type GeoCache = Record<string, Point | null>;
// Öffentliche Fassung: kein mitgelieferter Ortscache. Der lokale Server füllt ihn über src/geokodierung.ts
// (OpenStreetMap Nominatim, zwischengespeichert unter daten/geocache.json) und übergibt ihn hier.
// Schlüssel sind fünfstellige Postleitzahlen oder normalisierte Ortsnamen.
export function placeKey(location: string) {
  const normalized = normalize(location).trim(), postcode = location.match(/\b\d{5}\b/)?.[0];
  const city = normalize(location.replace(/\b\d{5}\b/g, "").split(/[·|/(,;–—]/)[0]).trim();
  return { normalized, postcode, city };
}
function point(location: string, cache: GeoCache): Point | undefined {
  const { normalized, postcode, city } = placeKey(location);
  if (city === "giessen") return { lat: 50.5841, lon: 8.6784 };
  const match = Object.entries(cache).find(([key]) => normalize(key) === normalized || normalize(key) === city || key === postcode)?.[1];
  return match && Number.isFinite(match.lat) && Number.isFinite(match.lon) ? match : undefined;
}
// Manche Listen nennen mehrere Einsatzorte („Würzburg, Neu-Isenburg“): ein Ort im Umkreis genügt.
// Bundesland- und Landesangaben sind keine Einsatzorte und werden nicht als Mittelpunkt gewertet.
export function offerPlaces(location: string): string[] {
  return location.split(/[,;|·\n/]|\s[-–—]\s/).map(s => s.trim()).filter((s, i) => s && (i === 0 || !isRegion(s)));
}
export function publicOfferScope(offer: Offer, city: string, radius: number, cache: GeoCache): "ok" | "role" | "outside" | "unknown" {
  if (!eligibleRole(offer.title) || !["werkstudent", "praktikum", "pflichtpraktikum", "studentische-hilfskraft"].includes(classifyContract(offer.title, offer.description))) return "role";
  if (!offer.location) return "unknown";
  const results = offerPlaces(offer.location).map(place => placeScope(place, city, radius, cache));
  return results.includes("ok") ? "ok" : results.includes("outside") ? "outside" : "unknown";
}
const REGION = /^(deutschland|germany|baden-wurttemberg|bayern|bavaria|berlin brandenburg|brandenburg|bremen|hamburg|hessen|hesse|mecklenburg-vorpommern|niedersachsen|lower saxony|nordrhein-westfalen|north rhine-westphalia|rheinland-pfalz|rhineland-palatinate|saarland|sachsen|saxony|sachsen-anhalt|schleswig-holstein|thuringen|thuringia|remote|homeoffice|home office|bundesweit)$/;
export const isRegion = (place: string) => REGION.test(normalize(place).trim());
function placeScope(location: string, city: string, radius: number, cache: GeoCache): "ok" | "outside" | "unknown" {
  const center = point(city, cache), target = point(location, cache);
  if (center && target) {
    const rad = (v: number) => v * Math.PI / 180;
    const h = Math.sin(rad(target.lat - center.lat) / 2) ** 2 + Math.cos(rad(center.lat)) * Math.cos(rad(target.lat)) * Math.sin(rad(target.lon - center.lon) / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h)) <= radius ? "ok" : "outside";
  }
  const place = normalize(location.replace(/\b\d{5}\b/g, "").split(/[·|/(,;–—]/)[0]).trim();
  return place === normalize(city).trim() ? "ok" : "unknown";
}
