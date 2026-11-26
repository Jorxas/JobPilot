/* global chrome */
/* Knopf im Popup: aktuelle Seite mit den JobPilot-Daten ausfüllen, auch wenn sie nicht über JobPilot geöffnet wurde. */
(() => {
  const knopf = document.getElementById('jp-frei'), status = document.getElementById('jp-status');
  if (!knopf || !status) return;
  knopf.onclick = async () => {
    knopf.disabled = true; status.textContent = 'Seite wird vorbereitet …';
    try {
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (!tab) throw Error('Kein aktiver Tab.');
      const r = await chrome.runtime.sendMessage({art: 'frei-starten', tabId: tab.id});
      if (!r?.ok) throw Error(r?.fehler || 'Nicht möglich.');
      status.textContent = 'Fertig. Das Ergebnis steht in der JP-Blase auf der Seite.';
      setTimeout(() => window.close(), 700);
    } catch (e) { status.textContent = e instanceof Error ? e.message : 'Nicht möglich.'; knopf.disabled = false; }
  };
})();
