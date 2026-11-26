/* global chrome */
/* Übergang zwischen der JP-Blase (panel.js) und dem Dienstskript der Erweiterung.
   Wird nur in Tabs eingesetzt, die JobPilot ausdrücklich geöffnet hat, im isolierten Kontext der Erweiterung.
   Die Arbeitgeberseite sieht weder diese Funktionen noch Profil oder Antworten. */
(() => {
  if (globalThis.__jobpilotAssistentBruecke) return;
  globalThis.__jobpilotAssistentBruecke = true;
  const zeigen = d => globalThis.jobpilotPanelAntwort?.(d);
  const lebt = () => { try { return !!chrome.runtime?.id; } catch { return false; } };
  async function verarbeiten(d) {
    try {
      if (!lebt()) return zeigen({text: 'Die Erweiterung wurde neu geladen. Bitte diese Seite neu laden.'});
      const r = await chrome.runtime.sendMessage({art: 'aktion', aktion: String(d.aktion || ''), question: typeof d.question === 'string' ? d.question.slice(0, 600) : undefined, answer: typeof d.answer === 'string' ? d.answer.slice(0, 4000) : undefined});
      if (!r) return zeigen({text: 'Assistent nicht erreichbar. Keine Bewerbung abgesendet.'});
      if (r.fehler) return zeigen({text: r.fehler});
      if (r.antwort) return zeigen(r.antwort);
      if (!r.daten) return zeigen({});
      if (r.origin !== location.origin) return zeigen({text: 'Die Seite hat gewechselt. Bitte die Website erneut bestätigen.'});
      const w = await globalThis.jobpilotMotorAufrufen(r.daten.profile, r.daten.bank, d.aktion, r.daten.dokumente || []);
      const fehlt = w => { const m = w.missing || w.missingFiles || []; return m.length ? ` Kein Dateifeld gefunden für: ${m.map(k => k === 'cv' ? 'Lebenslauf' : 'Anschreiben').join(', ')} (Dateifelder auf der Seite: ${w.fileFields ?? 0}).` : ''; };
      zeigen({bereit: true, text: d.aktion === 'dateien' ? `${w.attached?.length || 0} Dokumente zugeordnet.${fehlt(w)} Kein Versand.` : `${w.count || 0} Felder in diesem Durchlauf ausgefüllt${w.attached?.length ? `, ${w.attached.length} PDF angehängt` : ''}. ${w.pending?.length || 0} Fragen bleiben offen.${fehlt(w)}`, pending: w.pending || []});
    } catch {
      zeigen({text: lebt() ? 'Das Formular konnte nicht vollständig bedient werden. Bitte manuell prüfen.' : 'Die Erweiterung wurde neu geladen. Bitte diese Seite neu laden.'});
    }
  }
  // Die Blase ruft diese Funktion nur nach einem echten Benutzerklick (event.isTrusted) auf.
  globalThis.jobpilotAktion = payload => { let d; try { d = JSON.parse(payload); } catch { return; } if (d && typeof d === 'object') void verarbeiten(d); };
})();
