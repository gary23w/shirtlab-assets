import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

const gateway = process.argv.includes('--gateway');
const host = gateway ? process.env.RAPIDAPI_HOST : null;
const key = gateway ? process.env.RAPIDAPI_KEY : null;
if (gateway && (!host || !/^[a-z0-9-]+\.p\.rapidapi\.com$/.test(host) || !key)) throw Error('Set the actual RAPIDAPI_HOST and RAPIDAPI_KEY environment variables for gateway verification.');
const base = gateway ? `https://${host}/` : 'https://shirtlab.lol/api/wiki/v1/';
const headers = gateway ? { 'X-RapidAPI-Host': host, 'X-RapidAPI-Key': key } : {};
const report = { checkedAt: new Date().toISOString(), target: gateway ? 'rapidapi-gateway' : 'public-origin', baseUrl: base, passed: false, checks: [] };
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function request(route, status = 200, method = 'GET', extraHeaders = {}) {
  const response = await fetch(new URL(route, base), { method, headers: { ...headers, ...extraHeaders }, signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, status, `${method} ${route}: unexpected status`);
  if (!gateway) assert.equal(response.headers.get('Access-Control-Allow-Origin'), '*', route + ': CORS');
  report.checks.push({ method, route, status: response.status });
  return response;
}
async function json(route, status = 200) {
  const response = await request(route, status);
  assert.match(response.headers.get('Content-Type'), /application\/json/);
  const value = await response.json();
  if (status !== 200) assert.equal(typeof value.error, 'string');
  return value;
}
function asset(value, version) {
  assert.equal(value.version, version);
  assert.match(value.id, /^[a-z0-9-]+:[a-z0-9-]+$/);
  assert.equal(typeof value.label, 'string');
  assert.equal(typeof value.pack.author.name, 'string');
  assert.equal(typeof value.license.spdx, 'string');
  assert.match(value.licenseSha256, /^[a-f0-9]{64}$/);
  for (const field of ['url', 'shirtUrl', 'licenseUrl', 'downloadUrl', 'previewUrl', 'svgUrl']) assert.equal(new URL(value[field]).origin, 'https://shirtlab.lol', field);
  const studio = new URL(value.shirtUrl);
  assert.equal(studio.searchParams.get('workspace'), 'studio');
  assert.equal(studio.searchParams.get('iconPack'), value.pack.prefix);
  assert.equal(studio.searchParams.get('iconSearch'), value.name);
}
async function artwork(value, format = 'source', preview = false) {
  const route = `assets/${encodeURIComponent(value.id)}/${preview ? 'preview.svg' : 'download?format=' + format}`;
  const response = await request(route);
  const bytes = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('Content-Type');
  const png = !preview && (format === 'png' || format === 'source' && value.format === 'png');
  assert.match(contentType, png ? /image\/png/ : /image\/svg\+xml/);
  assert.match(response.headers.get('Content-Disposition'), preview ? /^inline;/ : /^attachment;/);
  const sha256 = digest(bytes);
  assert.equal(response.headers.get('X-Asset-SHA256'), sha256);
  if (png) {
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    if (value.source?.sha256) assert.equal(sha256, value.source.sha256);
  } else assert.match(bytes.toString(), /^<svg/);
  return { id: value.id, format: png ? 'png' : 'svg', preview, bytes: bytes.length, sha256 };
}
async function main() {
  const spec = JSON.parse(await readFile(new URL('./openapi.json', import.meta.url), 'utf8'));
  assert.equal(spec.openapi, '3.0.3');
  assert.equal(Object.keys(spec.paths).length, 6);
  assert.equal(spec.servers[0].url, 'https://shirtlab.lol/api/wiki/v1');
  const operationIds = new Set();
  function walk(value) {
    if (!value || typeof value !== 'object') return;
    if (value.$ref) {
      assert.ok(value.$ref.startsWith('#/'));
      let target = spec;
      for (const part of value.$ref.slice(2).split('/')) target = target?.[part];
      assert.ok(target, 'Unresolved specification reference');
    }
    assert.ok(!Array.isArray(value.type), 'OpenAPI 3.1 union remains');
    assert.ok(!Object.hasOwn(value, 'const'), 'OpenAPI 3.1 const remains');
    if (value.operationId) { assert.ok(!operationIds.has(value.operationId)); operationIds.add(value.operationId); }
    Object.values(value).forEach(walk);
  }
  walk(spec);
  report.specification = { version: spec.openapi, endpoints: operationIds.size, referencesResolved: true, importerCompatibilityAssertions: true };
  const [manifest, packs] = await Promise.all([json('manifest'), json('packs')]);
  assert.equal(manifest.schema, 'shirtlab.assets.v1');
  assert.equal(packs.version, manifest.version);
  assert.equal(packs.results.length, manifest.packCount);
  assert.equal(packs.results.reduce((sum, p) => sum + p.count, 0), manifest.count);
  assert.equal(new Set(packs.results.map(p => p.prefix)).size, manifest.packCount);
  report.snapshot = { version: manifest.version, assets: manifest.count, packs: manifest.packCount, datasetSha256: manifest.datasetSha256 };
  const first = await json('assets?q=controller&limit=2');
  assert.equal(first.results.length, 2); assert.equal(first.offset, 0); assert.equal(first.nextOffset, 2);
  const params = new URLSearchParams({ q: 'controller', limit: '2', offset: String(first.nextOffset), version: first.version });
  const second = await json('assets?' + params);
  assert.equal(second.version, first.version); assert.equal(second.total, first.total);
  assert.equal(new Set([...first.results, ...second.results].map(a => a.id)).size, 4);
  const [vector, rasterPage, cc0, absent, noMatch] = await Promise.all([
    json('assets/lucide%3Agamepad-2'), json('assets?pack=kenney-flag-pack&format=png&limit=1'),
    json('assets?license=CC0-1.0&limit=2'), json('assets/lucide%3Ano-such-asset-zzxyz', 404), json('assets?q=zzxyz-no-match-123&limit=1')
  ]);
  assert.equal(absent.error.length > 0, true);
  assert.equal(vector.id, 'lucide:gamepad-2'); assert.equal(vector.format, 'svg');
  assert.equal(rasterPage.results.length, 1);
  const raster = rasterPage.results[0]; assert.equal(raster.format, 'png'); assert.equal(raster.pack.prefix, 'kenney-flag-pack');
  cc0.results.forEach(a => assert.equal(a.license.spdx, 'CC0-1.0'));
  assert.equal(noMatch.total, 0); assert.equal(noMatch.nextOffset, null);
  [...first.results, ...second.results, vector, raster, ...cc0.results].forEach(a => asset(a, manifest.version));
  report.downloads = await Promise.all([artwork(vector), artwork(raster), artwork(raster, 'svg'), artwork(vector, 'source', true)]);
  await Promise.all([
    json('assets?limit=61', 400), json('assets?offset=-1', 400), json('assets?pack=unknown-zzxyz', 400),
    json('assets?version=outdated-snapshot-zzxyz', 409), json('assets/lucide%3Agamepad-2/download?format=png', 400)
  ]);
  if (!gateway) {
    const head = await request('assets/lucide%3Agamepad-2/download', 200, 'HEAD');
    assert.equal((await head.arrayBuffer()).byteLength, 0);
    const options = await request('assets', 204, 'OPTIONS', { Origin: 'https://example.com', 'Access-Control-Request-Method': 'GET' });
    assert.match(options.headers.get('Access-Control-Allow-Methods'), /GET/);
    const notice = await fetch(vector.licenseUrl, { signal: AbortSignal.timeout(30000) });
    assert.equal(notice.status, 200); assert.equal(digest(Buffer.from(await notice.arrayBuffer())), vector.licenseSha256);
    const wiki = await fetch(vector.url, { signal: AbortSignal.timeout(30000) });
    assert.equal(wiki.status, 200); assert.ok((await wiki.text()).includes(`rel="canonical" href="${vector.url}"`));
    report.publicAssetLinks = { canonicalWiki: true, creatorNoticeIntegrity: true, studioPackAndSearch: true };
  }
  report.passed = true;
}
try { await main(); } catch (error) { report.failure = String(error.message).slice(0, 500); process.exitCode = 1; }
const reportPath = process.argv.find(argument => argument.startsWith('--report='))?.slice(9);
if (reportPath) { await mkdir(dirname(reportPath), { recursive: true }); await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n'); }
console.log(JSON.stringify({ passed: report.passed, target: report.target, snapshot: report.snapshot, requests: report.checks.length, downloads: report.downloads?.length || 0, ...(report.failure ? { failure: report.failure } : {}), ...(reportPath ? { report: reportPath } : {}) }));
