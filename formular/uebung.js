/* Übungslauf: derselbe Feldmotor wie in der Erweiterung, mit einem erfundenen Profil. Es wird nichts abgesendet. */
(() => {
  const profil = { firstName: "Alex", lastName: "Beispiel", email: "alex@example.test", city: "Musterstadt", birthDate: "2001-03-14", state: "Hessen" };
  const frage = "wie haben sie von uns gehort";
  let bank = [];
  const status = document.getElementById("status");
  const motor = () => globalThis.jobAssistantFields;
  function bericht(r, zusatz) {
    status.textContent =
      `${r.count} Felder ausgefüllt, keine Bewerbung abgesendet.` +
      (r.attached?.length ? `\nAngehängt: ${r.attached.map((a) => a.name).join(", ")}` : "") +
      (r.pending?.length ? `\nOffene Fragen: ${r.pending.map((p) => p.label).join("; ")}` : "\nKeine offene Frage.") +
      (zusatz ? "\n" + zusatz : "");
  }
  async function pdf(kind, datei, name) {
    const antwort = await fetch(`../beispiel/${datei}`);
    const bytes = new Uint8Array(await antwort.arrayBuffer());
    let binaer = "";
    for (let i = 0; i < bytes.length; i += 8192) binaer += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return { kind, name, type: "application/pdf", base64: btoa(binaer) };
  }
  document.getElementById("lauf1").onclick = async () => bericht(await motor().run(profil, bank));
  document.getElementById("lauf2").onclick = async () => {
    bank = [{ question: frage, answer: "StepStone" }];
    bericht(await motor().run(profil, bank), "Antwort lokal in diesem Übungslauf gemerkt.");
  };
  document.getElementById("lauf3").onclick = async () => {
    const dateien = [
      await pdf("cv", "lebenslauf-beispiel.pdf", "Lebenslauf_Alex_Beispiel.pdf"),
      await pdf("letter", "anschreiben-beispiel.pdf", "Anschreiben_Alex_Beispiel.pdf"),
    ];
    bericht(await motor().run(profil, bank, { files: dateien }));
  };
  document.getElementById("neu").onclick = () => {
    bank = [];
    document.getElementById("uebung").reset();
    status.textContent = "Warten auf den ersten Durchlauf.";
  };
})();
