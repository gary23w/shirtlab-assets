# Shirt Lab Wiki Assets

An open-source interface, API, JavaScript SDK and collection builder for [shirtlab.lol/wiki](https://shirtlab.lol/wiki/).

## Use the public API

No API key or account is needed. Browsers can use CORS. The API is read-only.

```js
import { createAssetsClient } from './sdk.mjs';
const library = createAssetsClient();
const page = await library.search({ q: 'controller', limit: 12 });
console.log(page.results[0].downloadUrl, page.results[0].shirtUrl);
const asset = await library.asset('lucide:gamepad-2');
const file = await library.download(asset.id);
```

```sh
curl 'https://shirtlab.lol/api/wiki/v1/assets?q=pixel&limit=12'
curl -L 'https://shirtlab.lol/api/wiki/v1/assets/lucide%3Agamepad-2/download' -o gamepad.svg
```

See [API documentation](https://shirtlab.lol/wiki/api/) and [OpenAPI 3.1](https://shirtlab.lol/api/wiki/v1/openapi.json).

Search uses all words, common plural forms, and asset aliases, categories, pack names and creators. Filter by `pack`, `format` and `license`. Requests return up to 60 items. Continue with `nextOffset`; pin the returned `version`. A changed version returns 409. Download responses carry a SHA-256 header and ETag. PNG sources preserve embedded PNG bytes; SVG downloads preserve the catalogue representation, including source-view bounds where present.

## RapidAPI integration

The [RapidAPI integration package](rapidapi/) includes an OpenAPI 3.0.3 import, endpoint documentation, a server-side gateway client and an accessible card recipe with creator credits, downloads, Wiki links and Shirt Lab Studio links. Gateway hosts and credentials come from the actual marketplace project; the direct public SDK above does not require them.

## Collections

Save an asset with the bookmark on its preview. A green check and on-screen confirmation show the active collection; open View collection to download or export it. Named collections stay in browser local storage and sync between open Wiki tabs. When storage is unavailable, saving still works for the session and JSON export remains available. Export JSON for portability:

```json
{
  "schema": "shirtlab.collection.v1",
  "name": "Game night",
  "assets": ["lucide:gamepad-2", "lucide:skull"]
}
```

Collections support up to 2,000 unique IDs. ZIP exports contain artwork, asset metadata, source notices and links back to the shirt studio. ZIPs are generated in batches of up to 25 assets and 24 MiB of artwork to bound browser memory. Individual assets remain directly downloadable.

To download a collection with Node 20 or newer:

```sh
node download.mjs collection.json ./game-night
```

## Mirror and rebuild the dataset

Artwork binaries are not embedded in this Git repository. They retain their own licences and can be large. Fetch the versioned catalogue and its verified metadata:

```sh
node mirror.mjs ./snapshot
node build-index.mjs ./snapshot ./build
```

To include the actual artwork bundles, explicitly request them:

```sh
node mirror.mjs ./complete-snapshot --artwork
```

The mirror checks SHA-256 and byte counts, uses four concurrent requests and refuses to overwrite a populated directory. Keep source notices with redistributions. Index files are divided into bounded row, ID and word shards. The edge service reads only the shards needed for each request and caches at most 12 MiB of raw data.

## Host your own interface

`service.mjs` exports `freeAssetsRoute(request, assetsBinding, config)`. The assets binding implements `fetch(Request)` and serves the mirrored catalogue, generated dataset, and browser modules. Config contains `manifestPath`, `manifestBytes`, `manifestSha256`, and `repository`. The service supports GET, HEAD and CORS OPTIONS, server-rendered wiki pages and a documented API. Host `app.mjs`, `cards.mjs`, `sdk.mjs`, `library.css` and `vendor/fflate.mjs` under `/wiki/`. Adjust the canonical origin and API URLs for your own domain. Source sitemap files use at most 45,000 asset URLs each.

To render the root and first pack pages from an existing asset host directory:

```sh
node build-site.mjs ./host-assets ./static-pages ./build/preparation.json
```

The renderer uses the same service and dataset as the live API. Keep the generated browser modules and artwork resources alongside the pages.

## Licences

Original library code is MIT licensed. **Artwork is not relicensed under MIT.** Each asset retains its creator's licence, attribution, declarations and any applicable brand guidelines. Mixed-licence packs include per-asset overrides. Notices are linked from every asset and included in collection downloads. Trademarks remain with their owners. Vendored fflate has its own MIT notice in `vendor/fflate-LICENSE.txt`.

## Contribute

Read [CONTRIBUTING.md](CONTRIBUTING.md). Please report bugs with an asset ID, current manifest version and browser information. Do not include personal designs, checkout data or account credentials.