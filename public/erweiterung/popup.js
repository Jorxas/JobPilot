/* global chrome */
const PROFILE_DEFAULTS = {}; // PRIVATE_PROFILE_DEFAULTS
const $ = id => document.getElementById(id);
const status = message => { $('status').textContent = message; };
const labels = {firstName:'Prénom',lastName:'Nom de famille',fullName:'Nom complet',email:'E-mail',phone:'Téléphone avec indicatif',phoneCountryCode:'Indicatif séparé (facultatif, ex. +49)',city:'Ville',street:'Rue et numéro',houseNumber:'Numéro séparé (facultatif)',postalCode:'Code postal',country:'Pays de résidence',portfolio:'Portfolio',github:'GitHub',linkedin:'LinkedIn',availability:'Disponibilité (texte)',startDate:'Date de début (facultative)',weeklyHours:'Heures par semaine',annualSalary:'Salaire annuel brut en euros (sans séparateur, ex. 16640)',hourlySalary:'Salaire horaire brut en euros (facultatif)',internship:'Stage recherché',fieldOfInterest:'Domaine d’intérêt (ex. Softwareentwicklung und IT)',university:'Université / école',degree:'Formation en cours'};
const keys = Object.keys(labels);
const MAX_DOCUMENT = 3 * 1024 * 1024;
let answers = {}, bank = [], dossier = {}, preview = null, tabId = null, ready = false, lastPending = [];

function sanitize(value) { return Object.fromEntries(keys.filter(k => typeof value?.[k] === 'string' && value[k].length <= 3000).map(k => [k, value[k].trim()])); }
function sanitizeBank(value) {
  return (Array.isArray(value) ? value : []).filter(entry => entry && typeof entry.question === 'string' && typeof entry.answer === 'string' && entry.question && entry.question.length <= 300 && entry.answer.length <= 3000).map(entry => ({question: entry.question, answer: entry.answer}));
}
function sanitizeDossier(value) {
  const out = {};
  for (const kind of ['cv', 'letter']) {
    const d = value?.[kind];
    if (d && typeof d.base64 === 'string' && typeof d.name === 'string') out[kind] = {name: d.name.slice(0, 200), type: 'application/pdf', size: Number(d.size) || 0, sha256: String(d.sha256 || '').slice(0, 64), base64: d.base64};
  }
  return out;
}
function resetPreview() { preview = null; tabId = null; $('fill').disabled = true; $('preview').replaceChildren(); }
function renderProfile() { for (const key of keys) $('profile-' + key).value = answers[key] || ''; }
function renderBank() { $('bank-count').textContent = bank.length ? bank.length + ' réponse(s) mémorisée(s) pour les questions propres aux employeurs.' : 'Aucune réponse mémorisée pour l’instant.'; }
function renderDossier() {
  const list = $('doc-list'); list.replaceChildren();
  for (const [kind, title] of [['cv', 'CV'], ['letter', 'Lettre']]) {
    const d = dossier[kind]; if (!d) continue;
    const row = document.createElement('div'); row.className = 'doc';
    const text = document.createElement('span'); text.textContent = title + ' : ' + d.name + ' (' + Math.max(1, Math.round(d.size / 1024)) + ' Ko, empreinte ' + d.sha256.slice(0, 12) + ')';
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Retirer';
    remove.addEventListener('click', async () => { delete dossier[kind]; await chrome.storage.local.set({dossier}); renderDossier(); });
    row.append(text, remove); list.append(row);
  }
  if (!list.children.length) { const none = document.createElement('p'); none.className = 'note'; none.textContent = 'Aucune pièce choisie : seuls les champs texte seront remplis.'; list.append(none); }
}
for (const key of keys) {
  const label = document.createElement('label'); label.textContent = labels[key];
  const input = document.createElement('input'); input.id = 'profile-' + key; input.name = key;
  input.type = key === 'email' ? 'email' : key === 'phone' ? 'tel' : key === 'startDate' ? 'date' : ['weeklyHours', 'annualSalary', 'hourlySalary'].includes(key) ? 'number' : 'text';
  input.maxLength = 3000;
  if (input.type === 'number') { input.min = '0'; input.step = key === 'weeklyHours' ? '1' : '0.01'; }
  label.append(input); $('profile-fields').append(label);
}
const loaded = chrome.storage.local.get(['profile', 'answers', 'profileInitialized', 'bank', 'dossier']).then(async data => {
  answers = sanitize(data.profile || (data.profileInitialized ? {} : {...PROFILE_DEFAULTS, ...sanitize(data.answers)}));
  bank = sanitizeBank(data.bank); dossier = sanitizeDossier(data.dossier);
  if (!data.profileInitialized) await chrome.storage.local.set({profile: answers, profileInitialized: true});
  // Old per-company motivation must never carry into another employer's form.
  await chrome.storage.local.remove('answers'); renderProfile(); renderBank(); renderDossier();
  ready = true; $('inspect').disabled = false; $('autofill').disabled = false;
  if (!Object.values(answers).some(Boolean)) { $('profile-panel').open = true; status('Renseigne ton profil une seule fois, puis enregistre-le.'); }
}).catch(() => status('Profil inaccessible. Réouvre l’extension avant de remplir.'));

$('profile-form').addEventListener('input', () => { resetPreview(); $('inspect').disabled = true; $('autofill').disabled = true; status('Enregistre les modifications du profil avant de remplir.'); });
$('profile-form').addEventListener('submit', async event => {
  event.preventDefault(); await loaded; if (!ready) return;
  try {
    const next = sanitize(Object.fromEntries(keys.map(k => [k, $('profile-' + k).value])));
    await chrome.storage.local.set({profile: next, profileInitialized: true}); answers = next; resetPreview();
    $('inspect').disabled = false; $('autofill').disabled = false;
    status('Profil enregistré. Il sera réutilisé sur les prochaines candidatures.'); $('profile-panel').open = false;
  } catch { status('Enregistrement impossible. Réessaie avant de remplir.'); }
});

// Import: version 1 holds the profile only, version 2 also the saved answers.
$('answers-file').addEventListener('change', async event => {
  try {
    await loaded; if (!ready) return;
    const file = event.target.files[0]; if (!file || file.size > 500000) throw Error('Fichier absent ou trop volumineux.');
    const pack = JSON.parse(await file.text());
    if (![1, 2].includes(pack.version) || !pack.answers || typeof pack.answers !== 'object') throw Error('Format non reconnu.');
    answers = {...answers, ...sanitize(pack.answers)};
    if (pack.version === 2) { const incoming = sanitizeBank(pack.bank); bank = [...bank.filter(old => !incoming.some(entry => entry.question === old.question)), ...incoming]; }
    await chrome.storage.local.set({profile: answers, profileInitialized: true, bank});
    renderProfile(); renderBank(); resetPreview(); $('inspect').disabled = false; $('autofill').disabled = false;
    status('Coordonnées' + (pack.version === 2 ? ' et réponses' : '') + ' importées et mémorisées. Aucun import nécessaire la prochaine fois.');
  } catch (error) { status(error.message); }
});
$('export').addEventListener('click', async () => {
  await loaded; if (!ready) return;
  const blob = new Blob([JSON.stringify({version: 2, answers, bank}, null, 2)], {type: 'application/json'});
  const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'job-assistant-profil.json'; link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 2000);
  status('Fichier exporté. Il contient tes données personnelles : garde-le privé.');
});

// Documents of the current application (this company's own CV and letter).
async function readDocument(file) {
  if (!file) return null;
  if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') throw Error('Choisis un fichier PDF.');
  if (file.size > MAX_DOCUMENT) throw Error('PDF trop volumineux (3 Mo maximum).');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = ''; for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return {name: file.name, type: 'application/pdf', size: file.size, sha256: [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join(''), base64: btoa(binary)};
}
for (const kind of ['cv', 'letter']) {
  $('doc-' + kind).addEventListener('change', async event => {
    try { await loaded; const doc = await readDocument(event.target.files[0]); if (!doc) return; dossier[kind] = doc; await chrome.storage.local.set({dossier}); renderDossier(); status((kind === 'cv' ? 'CV' : 'Lettre') + ' enregistré pour cette candidature : ' + doc.name + '.'); }
    catch (error) { status(error.message); }
  });
}

// "Still to do": one input per unanswered question, saved once and reused on every later form.
function renderTodo(pending, missingFiles) {
  lastPending = pending.filter(item => item.kind !== 'file');
  const box = $('todo'); box.replaceChildren();
  const ordered = [...lastPending].sort((a, b) => Number(!!b.required) - Number(!!a.required));
  ordered.forEach((item, index) => {
    const label = document.createElement('label'); label.dataset.index = String(lastPending.indexOf(item));
    const text = document.createElement('span'); text.textContent = item.label.replace(/\s*\(erforderlich\)\s*/i, ''); if (item.required) text.className = 'required';
    let field;
    if (item.options?.length) { field = document.createElement('select'); field.append(new Option('', '')); for (const option of item.options) field.append(new Option(option, option)); }
    else if (item.kind === 'checkbox') { field = document.createElement('select'); field.append(new Option('', ''), new Option('Oui', 'ja'), new Option('Non', 'nein')); }
    else { field = document.createElement('input'); field.type = 'text'; field.maxLength = 3000; }
    field.id = 'todo-' + index; field.dataset.question = item.question || ''; label.append(text, field); box.append(label);
  });
  const files = (missingFiles || []).map(kind => (kind === 'cv' ? 'CV' : 'Lettre'));
  if (files.length) { const note = document.createElement('p'); note.className = 'note'; note.textContent = 'Pièce(s) à joindre à la main : ' + files.join(', ') + ' (aucun champ adapté trouvé).'; box.append(note); }
  $('todo-box').hidden = !ordered.length && !files.length;
}
function filesForPage() {
  return ['cv', 'letter'].filter(kind => dossier[kind]).map(kind => ({kind, name: dossier[kind].name, type: 'application/pdf', base64: dossier[kind].base64}));
}
async function fillPage() {
  await loaded; if (!ready || $('autofill').disabled) return;
  $('autofill').disabled = true; $('inspect').disabled = true; resetPreview(); status('Remplissage en cours…');
  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    if (!tab?.id) throw Error('Ouvre le formulaire employeur dans un onglet.');
    await chrome.scripting.executeScript({target: {tabId: tab.id}, files: ['fields.js']});
    const [result] = await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      func: async (data, mode, savedAnswers, files) => {
        if (mode !== 'automatic') return null;
        const api = globalThis.jobAssistantFields, run = await api.run(data, savedAnswers, {pace: 350, files});
        return {count: run.count, fields: run.filled, pending: run.pending, attached: run.attached, missingFiles: run.missingFiles};
      },
      args: [answers, 'automatic', bank, filesForPage()],
    });
    const out = result?.result;
    if (!Number.isInteger(out?.count)) throw Error('Formulaire inaccessible. Ouvre directement le portail employeur.');
    for (const field of out.fields) { const li = document.createElement('li'); li.textContent = field.label + ' → ' + String(field.value).slice(0, 240); $('preview').append(li); }
    for (const file of out.attached || []) { const li = document.createElement('li'); li.textContent = 'Pièce jointe ' + (file.kind === 'cv' ? 'CV' : 'lettre') + ' → ' + file.field + ' : ' + file.name; $('preview').append(li); }
    renderTodo(out.pending || [], dossier.cv || dossier.letter ? out.missingFiles : []);
    const total = out.count + (out.attached || []).length;
    status(total ? out.count + ' champ(s) rempli(s)' + (out.attached?.length ? ', ' + out.attached.length + ' pièce(s) jointe(s)' : '') + '. Vérifie les réponses ; aucun envoi effectué.' : 'Aucun champ vide reconnu avec ton profil. Vérifie « Mon profil » ou ouvre directement le formulaire employeur.');
  } catch (error) { status(error.message); }
  finally { if (ready) { $('autofill').disabled = false; $('inspect').disabled = false; } }
}
$('autofill').addEventListener('click', fillPage);
$('save-todo').addEventListener('click', async () => {
  await loaded; if (!ready) return;
  let saved = 0;
  for (const field of $('todo').querySelectorAll('select,input')) {
    const answer = field.value.trim(); const question = field.dataset.question; if (!answer || !question) continue;
    bank = [...bank.filter(entry => entry.question !== question), {question, answer}]; saved++;
  }
  try { await chrome.storage.local.set({bank}); renderBank(); } catch { status('Enregistrement impossible. Réessaie.'); return; }
  $('preview').replaceChildren();
  await fillPage();
  if (saved) status(saved + ' réponse(s) mémorisée(s). ' + $('status').textContent);
});

$('inspect').addEventListener('click', async () => {
  try {
    await loaded; if (!ready || $('inspect').disabled) return; resetPreview();
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true}); tabId = tab.id;
    await chrome.scripting.executeScript({target: {tabId}, files: ['fields.js']});
    const [result] = await chrome.scripting.executeScript({target: {tabId}, func: (data, savedAnswers) => globalThis.jobAssistantFields.inspect(data, savedAnswers), args: [answers, bank]});
    preview = result.result; if (!Array.isArray(preview)) throw Error('Page non compatible ou accès refusé.');
    for (const field of preview) { const li = document.createElement('li'); li.textContent = field.label + ' → ' + field.value.slice(0, 240); $('preview').append(li); }
    $('fill').disabled = !preview.length; status(preview.length + ' champ(s) vide(s) reconnu(s). Vérifie les valeurs avant de remplir.');
  } catch (error) { resetPreview(); status(error.message); }
});
$('fill').addEventListener('click', async () => {
  try {
    if (!preview || tabId === null) return;
    const [active] = await chrome.tabs.query({active: true, currentWindow: true});
    if (active.id !== tabId) throw Error('L’onglet a changé. Analyse le formulaire à nouveau.');
    const [result] = await chrome.scripting.executeScript({target: {tabId}, func: (data, fields, savedAnswers) => globalThis.jobAssistantFields.fill(data, fields, savedAnswers), args: [answers, preview, bank]});
    if (typeof result.result !== 'number') throw Error('Analyse à nouveau le formulaire.');
    status(result.result + ' champ(s) rempli(s). Vérifie et joins tes PDF ; aucun envoi effectué.');
  } catch (error) { status(error.message); } finally { resetPreview(); }
});
$('clear').addEventListener('click', async () => {
  await loaded;
  try {
    await chrome.storage.local.remove(['profile', 'answers', 'bank', 'dossier']); await chrome.storage.local.set({profileInitialized: true});
    answers = {}; bank = []; dossier = {}; renderProfile(); renderBank(); renderDossier(); resetPreview(); $('todo-box').hidden = true;
    $('profile-panel').open = true; $('inspect').disabled = false; status('Profil effacé.');
  } catch { status('Effacement impossible.'); }
});
