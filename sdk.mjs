/** No dependencies or API key. Works with browser and Node fetch. */
export function createAssetsClient({ baseUrl = 'https://shirtlab.lol', fetch: fetcher = globalThis.fetch } = {}) {
  const base = new URL('/api/wiki/v1/', baseUrl);
  async function get(path, parameters = {}, options = {}) {
    const url = new URL(path, base);
    for (const [key, value] of Object.entries(parameters)) if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
    const response = await fetcher(url, { signal: options.signal });
    if (!response.ok) throw new Error(`Shirt Lab assets: HTTP ${response.status}`);
    return response;
  }
  return {
    manifest: options => get('manifest', {}, options).then(r => r.json()),
    packs: options => get('packs', {}, options).then(r => r.json()),
    search: (parameters, options) => get('assets', parameters, options).then(r => r.json()),
    asset: (id, options) => get('assets/' + encodeURIComponent(id), {}, options).then(r => r.json()),
    download: (id, { format = 'source', signal } = {}) => get('assets/' + encodeURIComponent(id) + '/download', { format }, { signal }).then(r => r.blob()),
    async *iterate(parameters = {}, options = {}) {
      let offset = parameters.offset || 0, version = parameters.version;
      for (;;) {
        const page = await this.search({ ...parameters, version, offset, limit: parameters.limit || 60 }, options);
        version = page.version;
        yield* page.results;
        if (page.nextOffset === null) return;
        offset = page.nextOffset;
      }
    }
  };
}

export function validateCollection(value) {
  if (!value || value.schema !== 'shirtlab.collection.v1' || typeof value.name !== 'string' || value.name.length > 120 || !Array.isArray(value.assets) || value.assets.length > 2000) throw new Error('Choose a Shirt Lab collection containing up to 2,000 assets.');
  const ids = value.assets.map(asset => typeof asset === 'string' ? asset : asset?.id);
  if (ids.some(id => typeof id !== 'string' || !/^[a-z0-9-]+:[a-z0-9-]+$/.test(id) || id.length > 240) || new Set(ids).size !== ids.length) throw new Error('The collection contains invalid or repeated asset IDs.');
  return { schema: 'shirtlab.collection.v1', name: value.name, assets: ids, ...(typeof value.version === 'string' ? { version: value.version } : {}) };
}
