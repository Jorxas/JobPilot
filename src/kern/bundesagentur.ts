// Client for the Bundesagentur für Arbeit "Jobsuche" search API.
// Public, unauthenticated (beyond the fixed key below) — this is the same
// API the official Jobbörse site/app uses. See: https://github.com/bundesAPI/jobsuche-api
const BASE_URL = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service";
const API_KEY = "jobboerse-jobsuche";

export type JobSearchResult = {
  refnr: string;
  title: string;
  company: string | null;
  location: string | null;
  distanceKm: number | null;
  externalUrl: string | null;
  publishedAt?: string;
};

export type JobDetails = {
  refnr: string;
  title: string;
  company: string | null;
  descriptionText: string;
  externalUrl: string | null;
};

async function baRequest<T>(
  path: string,
  params?: Record<string, string | number>
): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, String(value));
    }
  }
  const res = await fetch(url, { headers: { "X-API-Key": API_KEY }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) {
    throw new Error(`Bundesagentur API error ${res.status}: ${await res.text()}`);
  }
  return res.json() as Promise<T>;
}

export async function searchJobs(opts: {
  keywords: string;
  city: string;
  radiusKm: number;
  page?: number;
  size?: number;
}): Promise<JobSearchResult[]> {
  const { keywords, city, radiusKm, page = 1, size = 25 } = opts;
  const data = await baRequest<{ ergebnisliste?: Record<string, unknown>[] }>(
    "/pc/v6/jobs",
    { was: keywords, wo: city, umkreis: radiusKm, page, size }
  );

  return (data.ergebnisliste ?? []).map((item) => {
    const lokationen = item.stellenlokationen as
      | Array<{ adresse?: { plz?: string; ort?: string } }>
      | undefined;
    const adresse = lokationen?.[0]?.adresse;
    const location = adresse
      ? [adresse.plz, adresse.ort].filter(Boolean).join(" ")
      : null;

    return {
      refnr: item.referenznummer as string,
      title: item.stellenangebotsTitel as string,
      company: (item.firma as string) ?? null,
      location: location || null,
      distanceKm: typeof item.entfernung === "number" ? item.entfernung : null,
      externalUrl: (item.externeURL as string) ?? null,
      publishedAt: typeof item.aktuelleVeroeffentlichungsdatum === "string" ? item.aktuelleVeroeffentlichungsdatum : undefined,
    };
  });
}

// The public Jobbörse detail page. Not every listing exposes an employer
// external URL via the API, but this page always exists — good fallback
// so every job always has somewhere to click through to.
export function jobPageUrl(refnr: string): string {
  return `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(refnr)}`;
}

export async function getJobDetails(refnr: string): Promise<JobDetails> {
  // The API expects the reference number base64-encoded in the path.
  // encodeURIComponent guards against '+', '/', '=' landing in a path segment.
  const encoded = Buffer.from(refnr, "utf-8").toString("base64");
  const data = await baRequest<Record<string, unknown>>(
    `/pc/v4/jobdetails/${encodeURIComponent(encoded)}`
  );

  return {
    refnr: data.referenznummer as string,
    title: data.stellenangebotsTitel as string,
    company: (data.firma as string) ?? null,
    descriptionText: (data.stellenangebotsBeschreibung as string) ?? "",
    externalUrl: (data.externeURL as string) ?? null,
  };
}
