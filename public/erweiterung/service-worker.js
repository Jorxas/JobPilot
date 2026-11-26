/* global chrome */
/* Dienstskript der JobPilot-Blase im eigenen Browserfenster.
   Es hält nur den Verlauf einer Sitzung je Tab (Bewerbungs-ID, Firma, bestätigte Website) in chrome.storage.session.
   Profil, Antwortbank und PDF werden bei jeder Aktion frisch über den geöffneten JobPilot-Tab geholt und nirgends gespeichert. */
const BLASE_DATEIEN = ['fields.js', 'assistent-bruecke.js', 'panel.js'];
const sitzungsSchluessel = id => 's' + id;
const jobpilotSchluessel = id => 'jp' + id;
const sitzungLesen = async tab => (await chrome.storage.session.get(sitzungsSchluessel(tab)))[sitzungsSchluessel(tab)] || null;
const sitzungSchreiben = (tab, wert) => chrome.storage.session.set({[sitzungsSchluessel(tab)]: wert});
const nurHttp = url => { try { return /^https?:$/.test(new URL(url).protocol); } catch { return false; } };

// Gleiche Regel wie zielUrl auf dem Server: ohne Zugangsdaten, nur HTTPS. Loopback-HTTP nur im ausdrücklichen Testmodus.
async function zielUrlPruefen(roh) {
  const u = new URL(roh);
  const lokal = (await chrome.storage.local.get('testmodus')).testmodus === true && u.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(u.hostname);
  if (u.username || u.password || (u.protocol !== 'https:' && !lokal)) throw Error('Bitte eine gültige öffentliche HTTPS-Arbeitgeberadresse verwenden.');
  return u.href;
}

async function bubbleEinsetzen(tabId) {
  if (!await sitzungLesen(tabId)) return;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!nurHttp(tab.url || tab.pendingUrl)) return;
    await chrome.scripting.executeScript({target: {tabId}, files: BLASE_DATEIEN});
  } catch { /* Seite nicht erreichbar oder nicht erlaubt: der Tab bleibt normal bedienbar. */ }
}

// Anfrage an den JobPilot-Server über einen geöffneten JobPilot-Tab (gleicher Ursprung, bestehende Anmeldung).
async function serverFragen(sitzung, tabId, body) {
  const alle = await chrome.storage.session.get(null);
  const kandidaten = [sitzung.jobpilotTab, ...Object.entries(alle).filter(([k, v]) => k.startsWith('jp') && v === sitzung.jobpilotOrigin).map(([k]) => Number(k.slice(2)))].filter((v, i, a) => Number.isInteger(v) && a.indexOf(v) === i);
  for (const kandidat of kandidaten) {
    let r;
    try { r = await chrome.tabs.sendMessage(kandidat, {art: 'server', body}); } catch { continue; }
    if (!r) continue;
    if (!r.ok) throw Error(r.fehler || 'Anfrage nicht möglich.');
    if (kandidat !== sitzung.jobpilotTab) { sitzung.jobpilotTab = kandidat; await sitzungSchreiben(tabId, sitzung); }
    return r.daten;
  }
  throw Error('Der JobPilot-Tab ist nicht mehr geöffnet. Bitte JobPilot öffnen und die Bewerbung erneut mit „Mit Assistent öffnen“ starten.');
}

async function oeffnen(nachricht, sender) {
  if (!sender.tab || sender.frameId !== 0 || typeof nachricht.id !== 'string' || typeof nachricht.firma !== 'string') return {ok: false, fehler: 'Ungültige Anfrage.'};
  const url = await zielUrlPruefen(nachricht.url);
  const tab = await chrome.tabs.create({url, windowId: sender.tab.windowId, index: sender.tab.index + 1, openerTabId: sender.tab.id, active: true});
  await sitzungSchreiben(tab.id, {id: nachricht.id, firma: nachricht.firma.slice(0, 200), jobpilotOrigin: new URL(sender.url).origin, jobpilotTab: sender.tab.id, origin: null});
  // Sehr schnelle Seiten können schon geladen sein, bevor die Sitzung gespeichert war.
  if ((await chrome.tabs.get(tab.id)).status === 'complete') await bubbleEinsetzen(tab.id);
  return {ok: true, tabId: tab.id};
}

async function aktion(nachricht, sender) {
  if (!sender.tab || sender.frameId !== 0) return {fehler: 'Nur im Hauptdokument des Tabs möglich.'};
  const tabId = sender.tab.id, sitzung = await sitzungLesen(tabId);
  if (!sitzung) return {fehler: 'Für diesen Tab ist keine JobPilot-Bewerbung geöffnet.'};
  if (sitzung.frei) return freiAktion(nachricht, sender, sitzung);
  const aktuell = new URL(sender.url), freigegeben = nurHttp(sender.url);
  // Vor jeder Aktion erneut: Bewerbung vorhanden, nicht versandt, Firma nicht bereits beworben.
  const stand = await serverFragen(sitzung, tabId, {aktion: 'status', id: sitzung.id});
  if (nachricht.aktion === 'bestaetigen') {
    if (!nurHttp(sender.url)) throw Error('Nicht unterstützte Website.');
    sitzung.origin = aktuell.origin; await sitzungSchreiben(tabId, sitzung);
    return {antwort: {bereit: true, text: 'Seite ausdrücklich bestätigt. Angaben werden erst nach Ihrem nächsten Klick ausgefüllt.'}};
  }
  if (nachricht.aktion === 'status') return {antwort: {firma: stand.firma || sitzung.firma, host: aktuell.hostname, bereit: freigegeben, text: freigegeben ? 'Bereit: bekannte Felder gezielt ausfüllen.' : 'Nicht unterstützte Website.'}};
  if (!freigegeben) throw Error('Nicht unterstützte Website.');
  if (!['fuellen', 'merken', 'dateien'].includes(nachricht.aktion)) return {};
  let body = {aktion: nachricht.aktion, id: sitzung.id};
  if (nachricht.aktion === 'merken') {
    if (typeof nachricht.question !== 'string' || typeof nachricht.answer !== 'string' || !nachricht.question || !nachricht.answer) throw Error('Antwort fehlt.');
    body = {...body, question: nachricht.question, answer: nachricht.answer};
  }
  const daten = await serverFragen(sitzung, tabId, body);
  // Die Seite darf zwischenzeitlich nicht gewechselt haben.
  const jetzt = await chrome.tabs.get(tabId), s2 = await sitzungLesen(tabId);
  if (!s2 || !jetzt.url || new URL(jetzt.url).origin !== aktuell.origin) return {};
  return {daten, origin: aktuell.origin};
}

// Seite ohne JobPilot-Bewerbung (zum Beispiel eine Stelle, die woanders gefunden wurde): gleiche Blase, aber nur mit Profil und
// Antwortbank. Es gibt keine eigenen PDF und keine Bewerbungsprüfung; die Blase hilft bei Feldern, nie beim Absenden.
async function freiAktion(nachricht, sender, sitzung) {
  const tabId = sender.tab.id, aktuell = new URL(sender.url);
  if (!nurHttp(sender.url)) throw Error('Nicht unterstützte Website.');
  if (nachricht.aktion === 'bestaetigen') return {antwort: {bereit: true, text: 'Bereit.'}};
  if (nachricht.aktion === 'status') return {antwort: {firma: 'Ohne Bewerbung', host: aktuell.hostname, bereit: true, text: 'Bereit: bekannte Felder mit deinen JobPilot-Daten ausfüllen. Ohne Bewerbung werden keine PDF angehängt.'}};
  if (nachricht.aktion === 'dateien') return {antwort: {bereit: true, text: 'Ohne Bewerbung gibt es keine eigenen PDF. Öffne die Stelle über „Mit Assistent öffnen“ in JobPilot, dann werden Lebenslauf und Anschreiben zugeordnet.'}};
  if (!['fuellen', 'merken'].includes(nachricht.aktion)) return {};
  let body = {aktion: 'profil'};
  if (nachricht.aktion === 'merken') {
    if (typeof nachricht.question !== 'string' || typeof nachricht.answer !== 'string' || !nachricht.question || !nachricht.answer) throw Error('Antwort fehlt.');
    body = {aktion: 'frei-merken', question: nachricht.question, answer: nachricht.answer};
  }
  const daten = await serverFragen(sitzung, tabId, body);
  const jetzt = await chrome.tabs.get(tabId);
  if (!jetzt.url || new URL(jetzt.url).origin !== aktuell.origin) return {};
  return {daten, origin: aktuell.origin};
}

// Vom Symbol der Erweiterung (Popup) ausgelöst: aktuellen Tab als freien Tab einrichten, Blase einsetzen und sofort ausfüllen.
// Der Klick im Popup ist die Benutzeraktion. LinkedIn und Indeed bleiben ausgenommen (eigene Bewerbungswerkzeuge).
async function freiStarten(nachricht, sender) {
  if (sender.tab) return {ok: false, fehler: 'Nur über das Symbol der Erweiterung möglich.'};
  const tab = await chrome.tabs.get(Number(nachricht.tabId));
  if (!tab.url || !nurHttp(tab.url)) return {ok: false, fehler: 'Auf dieser Seite nicht möglich. Öffne zuerst die Bewerbungsseite des Arbeitgebers.'};
  if (/(^|\.)(linkedin\.com|indeed\.[a-z.]+)$/.test(new URL(tab.url).hostname)) return {ok: false, fehler: 'LinkedIn und Indeed nutzen ihre eigenen Bewerbungswerkzeuge.'};
  const alle = await chrome.storage.session.get(null);
  let jp = null;
  for (const [schluessel, wert] of Object.entries(alle)) {
    if (!schluessel.startsWith('jp')) continue;
    const id = Number(schluessel.slice(2));
    try { if (await chrome.tabs.get(id)) { jp = {tab: id, origin: wert}; break; } } catch { /* Tab ist nicht mehr offen. */ }
  }
  if (!jp) return {ok: false, fehler: 'Bitte JobPilot in einem Tab öffnen (und die Seite einmal neu laden), damit die Erweiterung deine Daten holen kann.'};
  if (jp.tab === tab.id) return {ok: false, fehler: 'Auf der JobPilot-Seite selbst gibt es nichts auszufüllen.'};
  await sitzungSchreiben(tab.id, {id: null, frei: true, firma: 'Ohne Bewerbung', jobpilotOrigin: jp.origin, jobpilotTab: jp.tab, origin: null});
  await chrome.scripting.executeScript({target: {tabId: tab.id}, files: BLASE_DATEIEN});
  await chrome.scripting.executeScript({target: {tabId: tab.id}, func: () => {
    const wirt = document.querySelector('[data-jobpilot-assistent]'), kasten = wirt?.shadowRoot?.getElementById('kasten');
    if (kasten) { kasten.style.display = 'block'; wirt.shadowRoot.getElementById('blase')?.setAttribute('aria-expanded', 'true'); }
    globalThis.jobpilotAktion?.(JSON.stringify({aktion: 'fuellen'}));
  }});
  return {ok: true};
}

chrome.runtime.onMessage.addListener((nachricht, sender, antwort) => {
  if (sender.id !== chrome.runtime.id || !nachricht) return;
  let arbeit;
  if (nachricht.art === 'frei-starten') {
    arbeit = freiStarten(nachricht, sender).catch(e => ({ok: false, fehler: e instanceof Error ? e.message : 'Nicht möglich.'}));
    arbeit.then(antwort);
    return true;
  }
  if (nachricht.art === 'jobpilot-seite') {
    arbeit = (async () => { if (sender.tab && sender.frameId === 0) { await chrome.storage.session.set({[jobpilotSchluessel(sender.tab.id)]: new URL(sender.url).origin}); await chrome.storage.session.remove(sitzungsSchluessel(sender.tab.id)); /* JobPilot selbst erhält nie eine Blase. */ } return {ok: true}; })();
  } else if (nachricht.art === 'oeffnen') {
    arbeit = oeffnen(nachricht, sender).catch(e => ({ok: false, fehler: e instanceof Error ? e.message : 'Nicht möglich.'}));
  } else if (nachricht.art === 'aktion') {
    arbeit = aktion(nachricht, sender).catch(e => ({fehler: e instanceof Error ? e.message : 'Assistent nicht verfügbar. Keine Bewerbung abgesendet.'}));
  } else return;
  arbeit.then(antwort);
  return true;
});

chrome.tabs.onUpdated.addListener(async (tabId, info) => {
  // Die Blase bleibt in Tabs mit Sitzung über Seitenwechsel erhalten (mehrstufige Formulare).
  if (info.status === 'complete') await bubbleEinsetzen(tabId);
});
// Tabs, die von einem Sitzungs-Tab geöffnet werden (zum Beispiel Bewerbungsportale), erben die Bewerbung, aber nicht die Bestätigung.
chrome.tabs.onCreated.addListener(async tab => {
  if (!tab.openerTabId) return;
  const s = await sitzungLesen(tab.openerTabId);
  if (s) await sitzungSchreiben(tab.id, {...s, origin: null});
});
chrome.tabs.onRemoved.addListener(tabId => chrome.storage.session.remove([sitzungsSchluessel(tabId), jobpilotSchluessel(tabId)]));
