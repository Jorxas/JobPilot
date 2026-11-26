// Begrenzter Indeed-Leseabruf in einem eigenen Prozess. Keine Konten, Proxys oder Challenge-Lösung.
const https = require('node:https'), http = require('node:http');
let anfragen = 0;
const original = https.request;
https.request = function(ziel, ...rest) {
  const url = typeof ziel === 'string' || ziel instanceof URL ? new URL(ziel) : null;
  const host = url?.hostname || ziel.hostname || ziel.host;
  const pfad = url?.pathname || ziel.path;
  const methode = (url ? rest[0]?.method : ziel.method) || 'GET';
  if (host !== 'apis.indeed.com' || pfad !== '/graphql' || methode !== 'POST' || ++anfragen > 1)
    throw new Error('Nur eine Indeed-GraphQL-Anfrage erlaubt.');
  return original.call(this, ziel, ...rest);
};
http.request = () => { throw new Error('Unverschlüsselter Abruf gesperrt.'); };
let eingabe = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', d => { eingabe += d; if (eingabe.length > 8192) process.exit(2); });
process.stdin.on('end', async () => {
  try {
    const { begriff, stadt, radius } = JSON.parse(eingabe);
    if (typeof begriff !== 'string' || !begriff.trim() || begriff.length > 300 || typeof stadt !== 'string' || !stadt.trim() || stadt.length > 300 || !Number.isFinite(radius) || radius < 1 || radius > 200) throw Error('Ungültige Suchkriterien.');
    const { scrapeJobs } = require('ts-jobspy');
    const r = await scrapeJobs({ sites: ['indeed'], searchTerm: begriff, location: stadt,
      distance: Math.ceil(radius / 1.609344), country: 'germany', resultsWanted: 20,
      descriptionFormat: 'plain', timeoutMs: 20000, siteConcurrency: 1, verbose: 0 });
    const seite = r.meta.sites.find(s => s.site === 'indeed');
    // Auch ein HTTP-Fehler oder eine kaputte Antwort darf nie als leere erfolgreiche Suche gelten.
    process.stdout.write(JSON.stringify({ status: seite?.status, anfragen,
      jobs: r.jobs.map(j => ({ title: j.title, company: j.company,
        // Region und Land sind keine weiteren Einsatzorte für die Ortsauflösung.
        location: typeof j.location === 'string' ? j.location.replace(/,\s*(?:BW|BY|BE|BB|HB|HH|HE|MV|NI|NW|RP|SL|SN|ST|SH|TH),\s*DE$/, '') : j.location,
        url: j.jobUrl, description: j.description, posted_date: j.datePosted })) }));
  } catch {
    process.stdout.write(JSON.stringify({ status: 'error', anfragen, jobs: [] }));
  }
});
