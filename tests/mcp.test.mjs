import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const BIN = fileURLToPath(new URL('../bin/dia-chi-moi.mjs', import.meta.url));

function startServer() {
  const child = spawn(process.execPath, [BIN, 'mcp'], { stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = '';
  const waiting = new Map();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk) => {
    buf += chunk;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i);
      buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      const msg = JSON.parse(line);
      waiting.get(msg.id)?.(msg);
    }
  });
  let nextId = 1;
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      const timer = setTimeout(() => reject(new Error('timeout ' + method)), 15000);
      waiting.set(id, (m) => { clearTimeout(timer); resolve(m); });
      child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
    });
  const notify = (method, params) => child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method, params }) + '\n');
  return { child, request, notify };
}

test('mcp: initialize, tools/list, tools/call', async () => {
  const { child, request, notify } = startServer();
  try {
    const init = await request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '0' } });
    assert.equal(init.result.protocolVersion, '2025-06-18');
    assert.equal(init.result.serverInfo.name, 'dia-chi-moi');
    assert.ok(init.result.capabilities.tools);
    notify('notifications/initialized');

    const list = await request('tools/list', {});
    const names = list.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, ['convert_address', 'list_provinces', 'list_wards', 'parse_address', 'search_units', 'ward_origins']);
    for (const t of list.result.tools) assert.equal(t.inputSchema.type, 'object');

    const call = await request('tools/call', { name: 'convert_address', arguments: { address: 'Phường Bến Nghé, Quận 1, TP.HCM' } });
    const data = JSON.parse(call.result.content[0].text);
    assert.equal(data.status, 'ok');
    assert.equal(data.address, 'Phường Sài Gòn, Thành phố Hồ Chí Minh');

    const batch = await request('tools/call', { name: 'convert_address', arguments: { addresses: ['P.5, Q.Gò Vấp, HCM', 'Phường 1'] } });
    const b = JSON.parse(batch.result.content[0].text);
    assert.deepEqual(b.results.map((x) => x.status), ['ok', 'ambiguous']);

    const provs = await request('tools/call', { name: 'list_provinces', arguments: {} });
    assert.equal(JSON.parse(provs.result.content[0].text).provinces.length, 34);

    const bad = await request('tools/call', { name: 'parse_address', arguments: {} });
    assert.equal(bad.result.isError, true);

    const unknown = await request('tools/call', { name: 'nope', arguments: {} });
    assert.equal(unknown.error.code, -32602);

    const missing = await request('resources/list', {});
    assert.equal(missing.error.code, -32601);

    const pong = await request('ping');
    assert.deepEqual(pong.result, {});
  } finally {
    child.stdin.end();
    child.kill();
  }
});
