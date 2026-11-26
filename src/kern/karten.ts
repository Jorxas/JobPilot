// Plattformspezifische Trefferlisten; jede Datei karten-<plattform>.ts liefert nur Rohkarten.
import type { KartenParser } from "./karten-hilfe";
import type { PlatformId } from "./platforms";
import { karten as indeed } from "./karten-indeed";
import { karten as stepstone } from "./karten-stepstone";
import { karten as stellenanzeigen } from "./karten-stellenanzeigen";
import { karten as meinestadt } from "./karten-meinestadt";
import { karten as xing } from "./karten-xing";
import { karten as heyjobs } from "./karten-heyjobs";
import { karten as jobware } from "./karten-jobware";
import { karten as workwise } from "./karten-workwise";
import { karten as jobteaser } from "./karten-jobteaser";
import { karten as stellenwerk } from "./karten-stellenwerk";
import { karten as studentjob } from "./karten-studentjob";
import { karten as jobmensa } from "./karten-jobmensa";
import { karten as absolventa } from "./karten-absolventa";
import { karten as getInIt } from "./karten-get-in-it";
import { karten as jobvector } from "./karten-jobvector";
import { karten as unicum } from "./karten-unicum";
import { karten as mittelhessen } from "./karten-mittelhessen";
import { karten as thm } from "./karten-thm";
import { karten as stwgi } from "./karten-stwgi";

export const KARTEN: Partial<Record<PlatformId, KartenParser>> = {
  indeed, stepstone, stellenanzeigen, meinestadt, xing, heyjobs, jobware, workwise, jobteaser,
  stellenwerk, studentjob, jobmensa, absolventa, "get-in-it": getInIt, jobvector, unicum, mittelhessen, thm, stwgi,
};
