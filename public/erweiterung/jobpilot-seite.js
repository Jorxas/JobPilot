/* global chrome */
/* Inhaltsskript nur auf den JobPilot-Ursprüngen (siehe content_scripts in manifest.json).
   Es beantwortet den Handshake der JobPilot-Seite, startet auf deren ausdrücklichen Klick einen Tab und
   ruft den JobPilot-Server mit der bestehenden Anmeldung des Browsers auf (gleicher Ursprung, nur JSON).
   Arbeitgeberseiten sehen dieses Skript nie. */
(() => {
  if (globalThis.__jobpilotErweiterungSeite) return;
  globalThis.__jobpilotErweiterungSeite = true;
  const ENDPUNKT = '/api/jobpilot/erweiterung';
  const lebt = () => { try { return !!chrome.runtime?.id; } catch { return false; } };
  const senden = daten => window.postMessage({jobpilotErweiterung: true, ...daten}, location.origin);
  const server = async body => {
    const r = await fetch(location.origin + ENDPUNKT, {method: 'POST', credentials: 'same-origin', cache: 'no-store', headers: {'Content-Type': 'application/json', 'X-JobPilot-Erweiterung': '1'}, body: JSON.stringify(body)});
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(d.error || 'Anfrage nicht möglich.');
    return d;
  };
  const veraltet = 'Die Erweiterung wurde neu geladen. Bitte diese JobPilot-Seite neu laden.';
  if (lebt()) chrome.runtime.sendMessage({art: 'jobpilot-seite'}).catch(() => {});

  // Nachrichten der JobPilot-Seite: nur vom eigenen Fenster und eigenen Ursprung.
  window.addEventListener('message', async event => {
    if (event.source !== window || event.origin !== location.origin) return;
    const d = event.data;
    if (!d || d.jobpilotErweiterung !== true) return;
    const nonce = typeof d.nonce === 'string' ? d.nonce.slice(0, 80) : '';
    if (d.art === 'ping') return senden({art: 'pong', nonce, version: lebt() ? chrome.runtime.getManifest().version : null, veraltet: !lebt()});
    if (d.art !== 'start' || typeof d.id !== 'string' || !d.id || d.id.length > 200) return;
    try {
      if (!lebt()) throw Error(veraltet);
      const start = await server({aktion: 'start', id: d.id});
      const r = await chrome.runtime.sendMessage({art: 'oeffnen', id: d.id, firma: start.firma, url: start.url});
      if (!r?.ok) throw Error(r?.fehler || 'Der Tab konnte nicht geöffnet werden.');
      senden({art: 'gestartet', nonce, id: d.id, ok: true, firma: start.firma});
    } catch (e) {
      senden({art: 'gestartet', nonce, id: d.id, ok: false, fehler: lebt() ? (e instanceof Error ? e.message : 'Nicht möglich.') : veraltet});
    }
  });

  // Anfragen des Dienstskripts der Erweiterung: nur feste Aktionen, nur für eine Bewerbungs-ID oder ohne Bewerbung (Profil lesen, Antwort merken).
  if (lebt()) chrome.runtime.onMessage.addListener((nachricht, sender, antwort) => {
    if (sender.id !== chrome.runtime.id || nachricht?.art !== 'server') return;
    const b = nachricht.body || {};
    const body = {aktion: b.aktion, id: b.id};
    if (b.aktion === 'merken' || b.aktion === 'frei-merken') { body.question = b.question; body.answer = b.answer; }
    server(body).then(daten => antwort({ok: true, daten}), e => antwort({ok: false, fehler: e instanceof Error ? e.message : 'Nicht möglich.'}));
    return true;
  });
})();
