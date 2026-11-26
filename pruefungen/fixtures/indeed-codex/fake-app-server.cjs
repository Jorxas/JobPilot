// Synthetic protocol peer: never contacts a service or reads an account.
const readline = require('node:readline'), fs = require('node:fs');
const result = require('./result.json'), app = 'asdk_app_6982856578088191a6cf4a963662adf0';
const scenario = process.env.JOBPILOT_CODEX_TEST_SCENARIO || '';
const output = value => process.stdout.write(JSON.stringify(value) + '\n');
let searches = 0;
readline.createInterface({ input: process.stdin }).on('line', line => {
 const message = JSON.parse(line);
 if (process.env.JOBPILOT_CODEX_TEST_LOG) fs.appendFileSync(process.env.JOBPILOT_CODEX_TEST_LOG, JSON.stringify(message) + '\n');
 if (message.id == null) return;
 let data;
 switch (message.method) {
  case 'initialize': if(scenario==='bad-protocol') { process.stdout.write('null\n'); return; } data = { serverVersion: 'synthetic' }; break;
  case 'account/read': data = { account: { type: scenario === 'api-key' ? 'apiKey' : 'chatgpt' } }; break;
  case 'app/installed': data = { apps: scenario === 'missing-app' ? [] : [{ id: app, enabled: true, callable: true }] }; break;
  case 'thread/start': data = { thread: { id: 'synthetic-thread' } }; break;
  case 'mcpServerStatus/list': data = { data: [{ name: 'codex_apps', tools: { 'namespace.search_jobs': { name: 'namespace.search_jobs', annotations: { readOnlyHint: scenario !== 'not-read-only' }, _meta: { connector_id: scenario === 'wrong-app' ? 'other' : app }, inputSchema: { properties: { search: {}, location: {}, country_code: {}, radius: {} }, required: scenario === 'changed-schema' ? ['search', 'resume_id'] : ['search', 'location', 'country_code'] } } } }] }; break;
  case 'mcpServer/tool/call':
   searches++;
   if (scenario === 'close-on-search') return process.exit(0);
   data = scenario === 'second-error' && searches === 2 ? { isError: true, content: [{ type: 'text', text: 'Synthetic failure' }] } : result;
   break;
  default: return output({ id: message.id, error: { code: -32601, message: 'Unexpected protocol operation' } });
 }
 output({ id: message.id, result: data });
});
