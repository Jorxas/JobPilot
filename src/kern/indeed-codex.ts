// Indeed über die offizielle App „Indeed Job Search“ des eigenen ChatGPT-Kontos, angesprochen über das lokale
// Protokoll von „codex app-server“. Kein Modellzug, kein API-Schlüssel, kein Lebenslauf, kein direkter HTTP-Abruf
// von Indeed und keine Browsersteuerung.
// Öffentliche Fassung: nur mit JOBPILOT_INDEED_CODEX=1 (eigenes ChatGPT-Konto, eigene verbundene Indeed-App);
// Codex wird zusätzlich unter macOS und Linux gefunden (siehe README).
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { existsSync, statSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, dirname, isAbsolute, join } from "node:path";
import { createHash } from "node:crypto";
import { normalize, textOnly, type Offer, type SourceReport } from "./core";
import { platformSearchUrl } from "./platforms";

export const INDEED_APP_ID = "asdk_app_6982856578088191a6cf4a963662adf0";
const SERVER = "codex_apps", MAX_MESSAGE = 8_000_000, REQUEST_MS = 30_000;
type ObjectValue = Record<string, unknown>;
const object = (v: unknown): ObjectValue | null => v !== null && typeof v === "object" && !Array.isArray(v) ? v as ObjectValue : null;

export class IndeedCodexUnavailable extends Error {}
export type CodexProgram = { command: string; prefix: string[] };
const istDatei = (p: string | undefined) => { try { return !!p && existsSync(p) && statSync(p).isFile(); } catch { return false; } };
// Ausführbare Datei von Codex: eigene absolute Angabe (JOBPILOT_CODEX_CLI), sonst die native Datei der npm-Installation
// unter Windows, der Suchpfad und ~/.local/bin, zuletzt der npm-Starter codex.js über Node. Nie über eine Shell:
// .cmd-, .bat- und .ps1-Dateien werden deshalb nicht verwendet.
// Öffentliche Fassung: nur mit ausdrücklichem JOBPILOT_INDEED_CODEX=1; zusätzlich macOS und Linux (ohne .exe) und
// der npm-Starter neben der laufenden Node-Installation.
export function codexProgramm(env: NodeJS.ProcessEnv = process.env, plattform: NodeJS.Platform = process.platform, heim = homedir(), knoten = process.execPath): CodexProgram | null {
  if (env.JOBPILOT_INDEED_CODEX !== "1") return null;
  const custom = env.JOBPILOT_CODEX_CLI;
  if (custom) {
    if (!isAbsolute(custom) || !istDatei(custom)) return null;
    return /\.[cm]?js$/i.test(custom) ? { command: knoten, prefix: [custom] } : /\.(cmd|bat|ps1)$/i.test(custom) ? null : { command: custom, prefix: [] };
  }
  // Zuerst eine native Datei; eine gewöhnliche npm-Installation lässt sich auch ohne Shell über Node starten.
  const name = plattform === "win32" ? "codex.exe" : "codex";
  const native = (env.PATH || env.Path || "").split(delimiter).filter(Boolean).map(p => join(p, name));
  native.push(join(heim, ".local/bin", name));
  if (plattform === "win32" && env.APPDATA) native.unshift(join(env.APPDATA, "npm/node_modules/@openai/codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe"));
  const exe = native.find(istDatei);
  if (exe) return { command: exe, prefix: [] };
  const js = plattform === "win32" ? env.APPDATA && join(env.APPDATA, "npm/node_modules/@openai/codex/bin/codex.js") : join(dirname(knoten), "../lib/node_modules/@openai/codex/bin/codex.js");
  return js && istDatei(js) ? { command: knoten, prefix: [js] } : null;
}
// Ohne Freigabe oder ohne Codex bleibt Indeed ein Browserlink.
export const indeedViaCodexVerfuegbar = (env: NodeJS.ProcessEnv = process.env) => !!codexProgramm(env);

export function codexUmgebung(env: NodeJS.ProcessEnv = process.env) {
  const copy = { ...env };
  for (const k of Object.keys(copy)) if (/API_KEY|AUTH_TOKEN|SECRET|PASSWORD|DATABASE_URL|OPENAI_BASE_URL|OPENAI_ORG_ID|OPENAI_PROJECT_ID/i.test(k)) delete copy[k];
  return copy;
}

// Es werden nur benannte Protokolloperationen gesendet; der Server erhält nie turn/start und keinen Auftragstext.
class CodexRpc {
  private child: ChildProcessWithoutNullStreams;
  private next = 0;
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>();
  private buffer = "";
  private failed: Error | null = null;
  constructor(program: CodexProgram, env: NodeJS.ProcessEnv) {
    this.child = spawn(program.command, [...program.prefix, "app-server", "-c", "features.apps=true", "-c", "features.shell_tool=false"], { cwd: tmpdir(), env: codexUmgebung(env), windowsHide: true, shell: false });
    this.child.stdout.setEncoding("utf8");
    this.child.stdout.on("data", (data: string) => {
      this.buffer += data;
      if (this.buffer.length > MAX_MESSAGE) return this.fail(new Error("Codex-Antwort überschreitet das Größenlimit."));
      let end;
      while ((end = this.buffer.indexOf("\n")) >= 0) {
        const line = this.buffer.slice(0, end); this.buffer = this.buffer.slice(end + 1);
        let msg: ObjectValue; try { const parsed = object(JSON.parse(line)); if (!parsed) throw new Error(); msg = parsed; } catch { this.fail(new Error("Ungültige Codex-Protokollantwort.")); return; }
        if (typeof msg.id === "number" && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id)!; this.pending.delete(msg.id); clearTimeout(p.timer);
          if (msg.error) p.reject(new Error("Codex-Protokollaufruf fehlgeschlagen.")); else p.resolve(msg.result);
        } else if (msg.id !== undefined && typeof msg.method === "string") {
          // Keine Freigaben, Kontoanmeldung, Dateizugriffe, Rückfragen oder Gateway-Anmeldung werden automatisch ausgeführt.
          this.send({ id: msg.id, error: { code: -32601, message: "JobPilot only performs the authorized Indeed read operation." } });
        }
      }
    });
    this.child.stderr.on("data", () => { /* Diagnose- und Anmeldedaten nie in Berichte übernehmen. */ });
    this.child.stdin.on("error", () => this.fail(new Error("Codex-Verbindung geschlossen.")));
    this.child.on("error", () => this.fail(new Error("Codex konnte nicht gestartet werden.")));
    this.child.on("close", () => this.fail(new Error("Codex-Verbindung beendet.")));
  }
  private send(message: unknown) { if (!this.child.stdin.destroyed) this.child.stdin.write(JSON.stringify(message) + "\n"); }
  private fail(error: Error) {
    if (this.failed) return;
    this.failed = error;
    for (const p of this.pending.values()) { clearTimeout(p.timer); p.reject(error); }
    this.pending.clear(); this.child.kill();
  }
  call(method: string, params: unknown): Promise<unknown> {
    if (this.failed) return Promise.reject(this.failed);
    return new Promise((resolve, reject) => {
      const id = ++this.next;
      const timer = setTimeout(() => this.fail(new Error("Zeitüberschreitung beim Indeed-Zugang über Codex.")), REQUEST_MS);
      this.pending.set(id, { resolve, reject, timer }); this.send({ id, method, params });
    });
  }
  notify(method: string) { this.send({ method }); }
  close() { this.fail(new Error("JobPilot-Lesezugang geschlossen.")); }
}

export type IndeedCodexSession = { search: (keywords: string, city: string, radiusKm: number) => Promise<unknown>; close: () => void };
export async function openIndeedCodex(env: NodeJS.ProcessEnv = process.env): Promise<IndeedCodexSession> {
  const program = codexProgramm(env);
  if (!program) throw new IndeedCodexUnavailable("Indeed über ChatGPT/Codex ist nicht freigeschaltet (JOBPILOT_INDEED_CODEX=1) oder Codex wurde nicht gefunden.");
  const rpc = new CodexRpc(program, env);
  try {
    await rpc.call("initialize", { clientInfo: { name: "jobpilot_indeed", version: "1.0.0" }, capabilities: { experimentalApi: true, requestAttestation: false, explicitGatewayOauth: true } });
    rpc.notify("initialized");
    const account = object(await rpc.call("account/read", { refreshToken: false }));
    if (object(account?.account)?.type !== "chatgpt") throw new IndeedCodexUnavailable("Codex muss mit dem eigenen ChatGPT-Konto angemeldet sein; API-Schlüssel werden nicht verwendet.");
    const installed = object(await rpc.call("app/installed", { forceRefresh: true }));
    const app = Array.isArray(installed?.apps) ? installed.apps.map(object).find(a => a?.id === INDEED_APP_ID) : null;
    if (!app?.enabled || !app.callable) throw new IndeedCodexUnavailable("Indeed Job Search ist in Codex nicht verbunden oder nicht freigegeben. Plugin im eigenen ChatGPT-Konto verbinden.");
    const thread = object(await rpc.call("thread/start", { cwd: tmpdir(), ephemeral: true, approvalPolicy: "never", sandbox: "read-only", config: { "features.apps": true, "features.shell_tool": false } }));
    const threadId = object(thread?.thread)?.id;
    if (typeof threadId !== "string") throw new Error("Codex liefert keinen Lesezugang.");
    const status = object(await rpc.call("mcpServerStatus/list", { threadId, serverName: SERVER, detail: "toolsAndAuthOnly", limit: 100 }));
    const servers = Array.isArray(status?.data) ? status.data.map(object) : [];
    const tools = object(servers.find(s => s?.name === SERVER)?.tools);
    // Das Werkzeug ergibt sich aus vertrauenswürdigen Connector-Metadaten, nicht aus einem geratenen Namensraum oder Modelltext.
    const candidates = Object.values(tools || {}).map(object).filter(t => {
      const meta = object(t?._meta), annotations = object(t?.annotations);
      return meta?.connector_id === INDEED_APP_ID && typeof t?.name === "string" && /(?:^|[.])search_jobs$/.test(t.name) && annotations?.readOnlyHint === true && annotations?.destructiveHint !== true;
    });
    if (candidates.length !== 1) throw new IndeedCodexUnavailable("Das Indeed-Suchwerkzeug ist in Codex nicht eindeutig lesend verfügbar.");
    const tool = candidates[0]!, schema = object(tool.inputSchema), properties = object(schema?.properties);
    const required = schema?.required;
    if (!properties || !["search", "location", "country_code", "radius"].every(k => k in properties) || !Array.isArray(required) || required.some(k => typeof k !== "string" || !["search", "location", "country_code", "radius"].includes(k))) throw new Error("Das Indeed-Suchschema hat sich geändert; keine Suche ausgeführt.");
    return {
      search: (keywords, city, radiusKm) => rpc.call("mcpServer/tool/call", { threadId, server: SERVER, tool: tool.name, arguments: { search: keywords, location: city, country_code: "DE", radius: Math.ceil(radiusKm / 1.609344) } }),
      close: () => rpc.close(),
    };
  } catch (e) { rpc.close(); throw e; }
}

function dateOnly(value: unknown): string | undefined {
  if (typeof value !== "string") return;
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const english = value.match(/^([A-Z][a-z]+) (\d{1,2}), (\d{4})$/), iso = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const year = iso ? +iso[1] : english ? +english[3] : 0, month = iso ? +iso[2] : english ? months.indexOf(english[1]) + 1 : 0, day = iso ? +iso[3] : english ? +english[2] : 0;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (!year || !month || !day || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function codexIndeedErgebnis(raw: unknown) {
  const result = object(raw), data = object(result?.structuredContent);
  if (result?.isError || result?.error || !data || data.error || data.errorCode || !Array.isArray(data.jobs)) throw new Error("Indeed hat keine lesbare Trefferliste geliefert; kein erfolgreicher Abruf behauptet.");
  const offers: Offer[] = []; let rejected = 0;
  for (const value of data.jobs) {
    const job = object(value);
    if (!job || !["title", "company", "location", "url"].every(k => typeof job[k] === "string" && (job[k] as string).trim() && (job[k] as string).length <= (k === "url" ? 4096 : 300))) { rejected++; continue; }
    let url: URL; try { url = new URL(job.url as string); } catch { rejected++; continue; }
    if (url.protocol !== "https:" || url.username || url.password || url.port || !(url.hostname === "indeed.com" || url.hostname.endsWith(".indeed.com"))) { rejected++; continue; }
    if (job.description != null && typeof job.description !== "string" || typeof job.description === "string" && job.description.length > 50_000) { rejected++; continue; }
    const title = (job.title as string).trim(), company = (job.company as string).trim(), location = (job.location as string).trim(), description = textOnly(typeof job.description === "string" ? job.description : "");
    const key = [company, title, location].map(s => normalize(s).replace(/[^a-z0-9]+/g, " ").trim()).join("|");
    offers.push({ source: "indeed", externalRef: "codex-" + createHash("sha256").update(key).digest("hex").slice(0, 24), title, company, location, url: job.url as string, description, complete: description.length >= 150, publishedAt: dateOnly(job.posted_date) });
  }
  return { offers, rejected, totalAvailable: Number.isSafeInteger(data.totalAvailable) ? Number(data.totalAvailable) : undefined };
}

export type IndeedCodexScan = { offers: Offer[]; report: SourceReport; unavailable?: boolean };
export async function scanIndeedViaCodex(keywords: string[], city: string, radiusKm: number, open: () => Promise<IndeedCodexSession> = openIndeedCodex): Promise<IndeedCodexScan> {
  const terms = [...new Set(keywords.map(k => k.trim()).filter(Boolean))].slice(0, 5);
  const report: SourceReport = { source: "indeed", status: "error", found: 0, inserted: 0, limited: true, keywords: terms.join(" · "), searchUrl: platformSearchUrl("indeed", terms[0] || "", city, radiusKm), message: "" };
  if (!terms.length || terms.some(t => t.length > 300) || !city.trim() || city.length > 300 || !Number.isFinite(radiusKm) || radiusKm < 1 || radiusKm > 200) return { offers: [], report: { ...report, message: "Ungültige Indeed-Suchkriterien; keine Anfrage ausgeführt." } };
  const offers = new Map<string, Offer>(); let searches = 0, rejected = 0, session: IndeedCodexSession | undefined;
  try {
    session = await open();
    for (const term of terms) {
      const parsed = codexIndeedErgebnis(await session.search(term, city, radiusKm)); searches++; rejected += parsed.rejected;
      for (const offer of parsed.offers) { const previous = offers.get(offer.externalRef); if (!previous || offer.description.length > previous.description.length) offers.set(offer.externalRef, offer); }
    }
    report.status = "partial";
    report.message = `Indeed über ChatGPT/Codex: ${searches} Suchen, ${offers.size} eindeutige Treffer. Teilabruf; der genaue Umkreis und die Eignung werden in JobPilot geprüft.`;
  } catch (e) {
    report.status = searches ? "partial" : "error";
    report.message = `Indeed über ChatGPT/Codex nach ${searches} bestätigten Suchen unterbrochen: ${e instanceof Error ? e.message : "unbekannter Fehler"} Keine automatische Wiederholung.`;
    return { offers: [...offers.values()], report: { ...report, found: offers.size }, unavailable: e instanceof IndeedCodexUnavailable && !session };
  } finally { session?.close(); }
  if (rejected) report.message += ` ${rejected} unvollständige oder ungültige Karten nicht übernommen.`;
  report.found = offers.size;
  return { offers: [...offers.values()], report };
}
