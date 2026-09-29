/** Server-side gateway client. Keep your RapidAPI key out of public client bundles. */
export function createRapidApiClient({ host, key, fetch: fetcher = globalThis.fetch }) {
  if (!host || !/^[a-z0-9-]+\.p\.rapidapi\.com$/.test(host)) throw new Error('Use the host supplied by the RapidAPI project.');
  if (!key) throw new Error('A RapidAPI gateway key is required.');
  return async function request(path, parameters = {}) {
    if (!['manifest', 'packs', 'assets'].includes(path) && !/^assets\/[a-z0-9-]+%3A[a-z0-9-]+(?:\/(?:download|preview\.svg))?$/.test(path)) throw new Error('Choose an Assets API endpoint.');
    const url = new URL('/' + path, 'https://' + host);
    url.search = new URLSearchParams(parameters).toString();
    const response = await fetcher(url, { headers: { 'X-RapidAPI-Host': host, 'X-RapidAPI-Key': key } });
    if (!response.ok) throw new Error(`Assets API returned ${response.status}`);
    return response;
  };
}

/** Build a card without injecting SVG or metadata as HTML. The card contains no gateway key. */
export function assetCard(asset, document = globalThis.document) {
  const approvedUrl = value => {
    const url = new URL(value);
    if (url.origin !== 'https://shirtlab.lol') throw new Error('Expected a public Shirt Lab URL.');
    return url.href;
  };
  const card = document.createElement('article');
  const image = document.createElement('img');
  image.src = approvedUrl(asset.previewUrl); image.alt = asset.label; image.loading = 'lazy'; image.width = 160; image.height = 160;
  const title = document.createElement('h3'); title.textContent = asset.label;
  const credit = document.createElement('p'); credit.textContent = `${asset.pack.author.name} · ${asset.license.spdx}`;
  card.append(image, title, credit);
  for (const [label, href] of [
    ['Creator licence', asset.licenseUrl], ['Download', asset.downloadUrl],
    ['Details on Shirt Lab', asset.url], ['Find in Shirt Lab Studio', asset.shirtUrl]
  ]) {
    const link = document.createElement('a'); link.textContent = label; link.href = approvedUrl(href);
    card.append(link, document.createTextNode(' '));
  }
  return card;
}
