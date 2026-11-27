// Plattformspezifische Trefferlisten; jede Datei karten-<plattform>.ts liefert Rohkarten (karten) und, wo die Seite es
// erkennen lässt, die nächste Seite (weiter) und die ausdrückliche Leermeldung (leer).
import type { KartenParser, ListenModul, Seiten } from "./karten-hilfe";
import type { PlatformId } from "./platforms";
import * as indeed from "./karten-indeed";
import * as stepstone from "./karten-stepstone";
import * as stellenanzeigen from "./karten-stellenanzeigen";
import * as meinestadt from "./karten-meinestadt";
import * as xing from "./karten-xing";
import * as jobware from "./karten-jobware";
import * as workwise from "./karten-workwise";
import * as jobteaser from "./karten-jobteaser";
import * as stellenwerk from "./karten-stellenwerk";
import * as studentjob from "./karten-studentjob";
import * as jobmensa from "./karten-jobmensa";
import * as absolventa from "./karten-absolventa";
import * as getInIt from "./karten-get-in-it";
import * as unicum from "./karten-unicum";
import * as mittelhessen from "./karten-mittelhessen";
import * as thm from "./karten-thm";

const MODULE: Partial<Record<PlatformId, ListenModul>> = {
  indeed, stepstone, stellenanzeigen, meinestadt, xing, jobware, workwise, jobteaser,
  stellenwerk, studentjob, jobmensa, absolventa, "get-in-it": getInIt, unicum, mittelhessen, thm,
};
export const KARTEN: Partial<Record<PlatformId, KartenParser>> = Object.fromEntries(Object.entries(MODULE).map(([id, m]) => [id, m!.karten]));
export const SEITEN: Partial<Record<PlatformId, Seiten>> = Object.fromEntries(Object.entries(MODULE).map(([id, m]) => [id, { weiter: m!.weiter, leer: m!.leer, kopfzeilen: m!.kopfzeilen }]));
