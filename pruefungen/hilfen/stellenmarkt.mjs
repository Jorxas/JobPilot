// Gemockter Stellenmarkt für Prüfungen am lokalen Server. Die Arbeitsagentur liefert die angegebenen synthetischen Treffer,
// jede andere Adresse außerhalb des eigenen Rechners antwortet mit 403 (gilt als Sperre). Keine Anfrage verlässt den Rechner;
// jede versuchte Adresse wird gezählt.
export function stellenmarkt(echt, { treffer = () => [], tor = null } = {}) {
  const extern = [];
  const abruf = async (input, init) => {
    const u = String(input instanceof Request ? input.url : input);
    if (u.startsWith("http://127.0.0.1:")) return echt(input, init);
    extern.push(u);
    if (u.includes("/pc/v4/jobdetails/")) return new Response("", { status: 404 });
    if (u.startsWith("https://rest.arbeitsagentur.de/")) {
      if (tor) await tor();
      return Response.json({
        ergebnisliste: treffer().map((t) => ({
          referenznummer: t.ref,
          stellenangebotsTitel: t.titel,
          firma: t.firma,
          stellenlokationen: [{ adresse: { ort: t.ort || "Gießen" } }],
        })),
      });
    }
    return new Response("", { status: 403 });
  };
  return { abruf, extern };
}

// Ein Tor, das Anfragen anhält, bis es geöffnet wird (damit ein laufender Suchstart beobachtbar bleibt).
export function tor() {
  let oeffnen, offen = false;
  const warten = new Promise((r) => { oeffnen = r; });
  return { warten: () => (offen ? Promise.resolve() : warten), oeffnen: () => { offen = true; oeffnen(); } };
}
