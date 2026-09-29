# Free SVG icons, PNG artwork and game assets

Shirt Lab's Assets API makes its public library searchable from your app. Find interface icons, gaming graphics, pixel art, sprites and other design assets, then download their source files with creator credits and licence notices.

[Browse the Shirt Lab Asset Wiki](https://shirtlab.lol/wiki/) · [Read the API docs](https://shirtlab.lol/wiki/api/) · [Open the shirt designer](https://shirtlab.lol/?workspace=studio) · [Get the open-source SDK](https://github.com/gary23w/shirtlab-assets)

## Build with the library

- Search by words, pack, native SVG/PNG format or licence.
- Paginate a collection using `nextOffset` and a pinned dataset `version`.
- Download scalable SVG geometry or native PNG files. SHA-256 response headers let you verify the download.
- Keep creator names and original licences alongside the files.
- Link an asset's `url` to its Wiki page and `shirtUrl` to the same asset search in Shirt Lab Studio.

The current snapshot contains **439,476 asset representations across 393 packs**. Counts include style variants and repeated subjects; query `/manifest` for the current total as the library grows.

## Free access

The API origin is public and read-only, with CORS enabled. No additional Shirt Lab API key is required. When using the RapidAPI gateway, use the host and credentials supplied by RapidAPI and check the free plan's current request limits.

The Shirt Lab plan is $0 with no paid tiers or Shirt Lab request overage charges. The gateway currently allows 500,000 requests per month and 1,000 per hour. RapidAPI separately includes 10 GB of bandwidth per billing cycle and may charge consumers $0.001 per additional MB. For artwork downloads, the public `downloadUrl` bypasses gateway bandwidth billing. Direct origin access remains free. See [RapidAPI bandwidth policy](https://docs.rapidapi.com/docs/connecting-to-an-api).

## Artwork licences

Free API access does not replace the artists' terms. Read `license`, `licenseUrl` and any per-asset `terms` before using artwork. Some licences require attribution or have other conditions. The original library code and SDK are MIT-licensed; the artwork retains its individual licences.

If the library helps your project, an optional **“Assets from [Shirt Lab](https://shirtlab.lol/wiki/)”** link helps others find it. Preserve all attribution required by the original creators.
