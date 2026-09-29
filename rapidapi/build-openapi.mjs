import { readFile, writeFile } from 'node:fs/promises';

// Keep the public API contract authoritative; this adapter targets the Hub's 3.0 importer.
const source = JSON.parse(await readFile(new URL('../openapi.json', import.meta.url), 'utf8'));
function compatible(value) {
  if (Array.isArray(value)) return value.map(compatible);
  if (!value || typeof value !== 'object') return value;
  const result = Object.fromEntries(Object.entries(value).map(([key, child]) => [key, compatible(child)]));
  if (Array.isArray(result.type)) {
    const types = result.type.filter(type => type !== 'null');
    if (types.length !== 1) throw Error('Unsupported union in OpenAPI adapter');
    result.type = types[0]; result.nullable = true;
  }
  if (Object.hasOwn(result, 'const')) { result.enum = [result.const]; delete result.const; }
  return result;
}
const spec = compatible(source);
spec.openapi = '3.0.3';
spec.info = {
  title: 'Shirt Lab Free Icons & Game Assets', version: source.info.version,
  description: 'Search SVG icons, native PNG artwork, pixel art and game assets. Metadata includes creator licences, source downloads, a canonical Shirt Lab Wiki page and a link to find the asset in the shirt designer. Free access; artwork retains its individual creator licence. RapidAPI supplies its own gateway credentials; no additional Shirt Lab API key is needed.',
  contact: { name: 'Shirt Lab Assets', url: 'https://shirtlab.lol/wiki/' },
  license: { name: 'MIT (original library code only; artwork has individual licences)', url: 'https://github.com/gary23w/shirtlab-assets/blob/main/LICENSE' }
};
spec.externalDocs = { description: 'Shirt Lab Wiki API documentation, downloads and collections', url: 'https://shirtlab.lol/wiki/api/' };
spec.servers = [{ url: 'https://shirtlab.lol/api/wiki/v1', description: 'Live, public Shirt Lab Assets API' }];
spec.tags = [
  { name: 'Catalogue', description: 'Current dataset version and creator packs.' },
  { name: 'Assets', description: 'Search, metadata, previews and source downloads.' }
];
const string = description => ({ type: 'string', ...(description ? { description } : {}) });
const uri = description => ({ type: 'string', format: 'uri', ...(description ? { description } : {}) });
const ref = name => ({ $ref: '#/components/schemas/' + name });
spec.components.schemas.License = { type: 'object', required: ['title', 'spdx'], properties: {
  title: string(), spdx: string('Creator licence identifier. Read the linked notice before reuse.'), url: uri()
}};
spec.components.schemas.Pack = { type: 'object', required: ['prefix', 'name', 'count', 'author', 'license', 'licenseUrl', 'licenseSha256', 'url'], properties: {
  prefix: string(), name: string(), count: { type: 'integer', minimum: 0 },
  author: { type: 'object', required: ['name'], properties: { name: string(), url: uri() } },
  license: ref('License'), licenseUrl: uri('Complete creator notice hosted by Shirt Lab.'),
  licenseSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, source: uri(),
  vectorCount: { type: 'integer', minimum: 0 }, rasterCount: { type: 'integer', minimum: 0 },
  url: uri('Browse this creator pack in the Shirt Lab Wiki.')
}};
spec.components.schemas.Asset = { type: 'object', required: ['id', 'name', 'label', 'pack', 'format', 'editable', 'license', 'licenseUrl', 'licenseSha256', 'url', 'shirtUrl', 'downloadUrl', 'svgUrl', 'previewUrl', 'version'], properties: {
  id: { type: 'string', pattern: '^[a-z0-9-]+:[a-z0-9-]+$', maxLength: 240, example: 'lucide:gamepad-2' },
  name: string(), label: string(), pack: ref('Pack'), format: { type: 'string', enum: ['svg', 'png'] },
  editable: { type: 'string', enum: ['vector', 'image'] }, categories: { type: 'array', items: string() }, aliases: string(),
  license: ref('License'), licenseUrl: uri('Original creator notice; preserve required attribution.'),
  licenseSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, terms: { type: 'object', additionalProperties: true }, source: { type: 'object', additionalProperties: true },
  url: uri('Canonical Wiki page. Link here for asset details, downloads and creator credits.'),
  shirtUrl: uri('Open Shirt Lab Studio with this pack and asset search selected.'),
  downloadUrl: uri('Direct public download URL. No gateway credentials are needed at this URL.'),
  svgUrl: uri('SVG source, or SVG wrapper containing the original PNG for raster artwork.'),
  previewUrl: uri('Display preview URL, which can be SVG or PNG.'), version: string('Pin this snapshot during pagination.')
}};
spec.components.schemas.Packs = { type: 'object', required: ['version', 'results'], properties: {
  version: string(), results: { type: 'array', items: ref('Pack') }
}};
spec.components.schemas.Manifest = { type: 'object', required: ['schema', 'version', 'count', 'packCount', 'formats', 'licenses', 'search', 'dataset', 'datasetSha256', 'catalogueSha256', 'openapi', 'source'], properties: {
  schema: string(), version: string(), count: { type: 'integer', minimum: 0 }, packCount: { type: 'integer', minimum: 0 },
  formats: { type: 'array', items: { type: 'string', enum: ['svg', 'png'] } }, licenses: { type: 'array', items: string() },
  search: { type: 'object', properties: { mode: string(), maximumQueryLength: { type: 'integer' }, maximumWords: { type: 'integer' }, stopWords: { type: 'array', items: string() }, pluralForms: { type: 'boolean' } } },
  dataset: uri(), datasetSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' }, catalogueSha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
  openapi: uri(), source: uri('Open-source SDK and catalogue tooling.')
}};
const idParameter = { name: 'id', in: 'path', required: true, description: 'Pack prefix and asset name separated by a colon. Percent-encode the complete ID when building a URL.', schema: { type: 'string', pattern: '^[a-z0-9-]+:[a-z0-9-]+$', maxLength: 240 }, example: 'lucide:gamepad-2' };
const versionParameter = { name: 'version', in: 'query', description: 'Optional snapshot version from /manifest. A stale version returns 409.', schema: string() };
const describe = (route, tag, summary, description, schema) => {
  const get = spec.paths[route].get;
  get.tags = [tag]; get.summary = summary; get.description = description;
  if (schema) get.responses['200'].content['application/json'].schema = ref(schema);
  return get;
};
describe('/manifest', 'Catalogue', 'Get the library version and capabilities', 'Use this lightweight endpoint as the health check. Counts represent downloadable asset representations, including style variants. Fetch version before a paginated collection export.', 'Manifest');
describe('/packs', 'Catalogue', 'Browse creator packs and licences', 'Discover pack prefixes for search filters, creator credits and licence notices. Each pack includes a canonical Wiki link.', 'Packs');
const search = describe('/assets', 'Assets', 'Search free icons, pixel art and game assets', 'Search uses all meaningful words and common plural forms across names, aliases, categories, packs and creators. Filter by pack, source format or licence. Follow nextOffset and pin version to build a collection.', 'SearchPage');
const descriptions = {
  q: 'Up to 160 characters and eight meaningful words. An empty query browses the catalogue.',
  pack: 'Exact prefix from /packs, for example lucide. Unknown prefixes return 400.',
  format: 'Native downloadable source format, SVG or PNG. This is not a rasterization request.',
  license: 'Exact identifier from manifest.licenses, for example CC0-1.0. This filters individual asset licences.',
  version: versionParameter.description,
  limit: 'Page size: 1–60, default 48.', offset: 'Zero-based result offset. Use nextOffset from the previous page.'
};
for (const parameter of search.parameters) {
  parameter.description = descriptions[parameter.name];
  if (parameter.name === 'q') parameter.example = 'controller';
}
const detail = describe('/assets/{id}', 'Assets', 'Get asset details and Shirt Lab links', 'Includes downloadUrl, previewUrl, creator licence, canonical Wiki url and shirtUrl. A shirtUrl opens Studio with the asset search selected; adding artwork is a user action.', 'Asset');
detail.parameters = [idParameter, versionParameter];
const download = describe('/assets/{id}/download', 'Assets', 'Download SVG or original PNG artwork', 'Default format=source returns SVG geometry or native PNG bytes. format=svg is also available for PNG assets as an SVG wrapper. format=png works only for native PNG assets; SVG-to-PNG conversion is not offered. Preserve each creator licence. Verify bytes with X-Asset-SHA256.');
download.parameters = [idParameter, { name: 'format', in: 'query', description: 'Choose source, SVG, or native PNG.', schema: { type: 'string', enum: ['source', 'svg', 'png'], default: 'source' } }, versionParameter];
const hashHeader = { description: 'SHA-256 digest of the exact response bytes.', schema: { type: 'string', pattern: '^[a-f0-9]{64}$' } };
const binary = { schema: { type: 'string', format: 'binary' } };
download.responses['200'] = { description: 'Source artwork, served as an attachment.', headers: {
  'Content-Disposition': { schema: string(), description: 'Attachment with a pack and asset filename.' }, 'X-Asset-SHA256': hashHeader, ETag: { schema: string() }
}, content: { 'image/svg+xml': binary, 'image/png': binary } };
spec.paths['/assets/{id}/preview.svg'] = { get: {
  operationId: 'previewAsset', tags: ['Assets'], summary: 'Preview an asset as SVG',
  description: 'Inline SVG preview. Native PNG artwork remains embedded at its original resolution. For a lighter display preview, prefer the metadata previewUrl when provided.',
  parameters: [idParameter, versionParameter], responses: {
    ...Object.fromEntries(Object.entries(download.responses).filter(([status]) => status !== '200')),
    '200': { description: 'Inline SVG preview.', headers: { 'X-Asset-SHA256': hashHeader, ETag: { schema: string() } }, content: { 'image/svg+xml': binary } }
  }
}};
for (const path of Object.values(spec.paths)) for (const operation of Object.values(path)) {
  if (operation.responses['409']) operation.responses['409'].description = 'Snapshot changed. Refresh /manifest and restart pagination.';
  if (operation.responses['503']) operation.responses['503'].description = 'The catalogue or source file is temporarily unavailable. Retry later.';
}
const responseExamples = JSON.parse(await readFile(new URL('./response-examples.json', import.meta.url), 'utf8'));
for (const [route, sample] of Object.entries(responseExamples)) spec.paths[route].get.responses['200'].content['application/json'].example = sample;
for (const operation of Object.values(spec.paths).map(path => path.get)) operation.externalDocs = spec.externalDocs;
await writeFile(new URL('./openapi.json', import.meta.url), JSON.stringify(spec, null, 2) + '\n');
console.log(JSON.stringify({ openapi: spec.openapi, endpoints: Object.keys(spec.paths).length, baseUrl: spec.servers[0].url }));
