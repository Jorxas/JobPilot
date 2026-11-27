// Die gebaute Oberfläche läuft an zwei Orten: als statische Demo (GitHub Pages; demo.js liefert erfundene Daten im Browser)
// und am lokalen Server, der dieselbe Seite ohne demo.js und mit <meta name="jobpilot-modus" content="lokal"> ausliefert.
export const lokal = () => document.querySelector('meta[name="jobpilot-modus"]')?.getAttribute("content") === "lokal";
