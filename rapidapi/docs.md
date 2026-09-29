# Quick start

Start with `GET /manifest`, then `GET /assets?q=controller&limit=12`.

Use the real gateway host and key shown in RapidAPI's endpoint playground. Keep gateway credentials on your server, not in public browser code. There is no additional Shirt Lab API key.

```js
// Server-side JavaScript. Set these environment variables from the playground.
const host = process.env.RAPIDAPI_HOST;
const key = process.env.RAPIDAPI_KEY;
const url = new URL('/assets', `https://${host}`);
url.search = new URLSearchParams({ q: 'controller', limit: '12' });
const response = await fetch(url, {
  headers: { 'X-RapidAPI-Host': host, 'X-RapidAPI-Key': key }
});
if (!response.ok) throw new Error(`Assets API returned ${response.status}`);
const page = await response.json();
for (const asset of page.results) console.log(asset.id, asset.label, asset.url, asset.shirtUrl);
```

Gateway paths above must match the imported project and its generated snippet. The provider base URL is `https://shirtlab.lol/api/wiki/v1`; it is configured once in the API project, rather than repeated inside endpoint paths.

For direct public browser access, use [the origin API and SDK](https://shirtlab.lol/wiki/api/). Metadata's `downloadUrl`, `previewUrl`, `url` and `shirtUrl` are public Shirt Lab URLs; never attach gateway credentials to those links.

## Free plan and platform limits

The Shirt Lab plan is $0 with no paid tiers or Shirt Lab request overage charges. The gateway currently allows 500,000 requests per month and 1,000 per hour. RapidAPI separately includes 10 GB of bandwidth per billing cycle and may charge consumers $0.001 per additional MB. For artwork downloads, the public `downloadUrl` bypasses gateway bandwidth billing. Direct origin access remains free. See [RapidAPI bandwidth policy](https://docs.rapidapi.com/docs/connecting-to-an-api).

## Endpoints

| Endpoint | Purpose |
| --- | --- |
| `GET /manifest` | Dataset version, counts, source formats and licence filters |
| `GET /packs` | Creator packs, credits and complete licence notices |
| `GET /assets` | Search and paginate with `q`, `pack`, `format`, `license`, `limit`, `offset`, `version` |
| `GET /assets/{id}` | Asset metadata, download URLs and Shirt Lab links |
| `GET /assets/{id}/download` | Download `source`, `svg`, or native `png` |
| `GET /assets/{id}/preview.svg` | Inline SVG preview |

Asset IDs use `pack:name`, for example `lucide:gamepad-2`. Build paths using `encodeURIComponent(id)` so the colon is safely encoded. Search accepts up to 160 characters and eight meaningful words. Page size is 1–60, default 48. `format=png` selects native PNG assets; the API does not rasterize SVG artwork to PNG.

## Create a collection

Capture the first search page's `version`. Request subsequent pages with that version and `offset=nextOffset`; stop at `nextOffset=null`. A `409` means the snapshot changed: refresh the manifest and restart to avoid mixing versions.

Store asset IDs and creator licence information with your collection. The [Wiki collection tools](https://shirtlab.lol/wiki/) offer named collections, portable JSON and ZIP downloads containing artwork and licence notices. [Open-source collection utilities](https://github.com/gary23w/shirtlab-assets) support integrations.

## Turn a result into a useful card

Use `previewUrl` for the image and `label` for accessible text. Include the creator and a link to `licenseUrl`. Give the card these actions:

- **Download** → `downloadUrl`
- **Details and creator credits** → `url`
- **Find in Shirt Lab Studio** → `shirtUrl`

The Studio link selects the asset's pack and search. The user can add the artwork and choose its placement. [See the card example](https://github.com/gary23w/shirtlab-assets/blob/main/rapidapi/examples.mjs).

## Download integrity and errors

Verify downloaded bytes against `X-Asset-SHA256`. Downloads include an attachment filename and an ETag. Native PNG assets retain their original PNG bytes; SVG returns the library's scalable SVG representation. `format=svg` for PNG assets returns an SVG wrapper with the PNG embedded.

JSON errors have an `error` message: `400` invalid filter or unavailable format; `404` unknown asset; `409` changed dataset version; `503` temporarily unavailable source. Handle these responses before using the body as artwork.

## Useful links

[Search the full asset Wiki](https://shirtlab.lol/wiki/) · [API reference](https://shirtlab.lol/wiki/api/) · [Design a shirt](https://shirtlab.lol/?workspace=studio) · [Source code and issues](https://github.com/gary23w/shirtlab-assets)

An optional “Assets from Shirt Lab” link helps people discover this free resource. It does not replace the original artists' required attribution or licences.
