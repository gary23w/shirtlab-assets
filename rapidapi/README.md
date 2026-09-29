# RapidAPI provider package

Import `openapi.json` into a private API project. It targets OpenAPI 3.0.3 while preserving the public origin contract. Run `node rapidapi/build-openapi.mjs` to regenerate it when the origin specification changes.

Use `listing.json` for provider fields, `overview.md` for the long description and `docs.md` for the About/readme. The current Shirt Lab logo is [icon-192.png](https://shirtlab.lol/icon-192.png), within the Hub's 500 × 500 size limit.

Set the upstream base URL to `https://shirtlab.lol/api/wiki/v1`, and use `/manifest` as the health check. Configure free BASIC only, with price zero and no billable overages. Verify the actual marketplace free label and quota in the current UI.

Run `node rapidapi/verify.mjs` before publication. It saves a bounded readiness receipt to a supplied path (`--report=...`) or prints a summary. By default it verifies the public origin. To test an actual gateway, set `RAPIDAPI_HOST` and `RAPIDAPI_KEY` in the environment and use `--gateway`; it does not print or save credentials. Do not put the key in a command argument, a repository file or public browser code.

## Publication gates

1. Inspect existing API projects to avoid duplicate listings.
2. Import the specification, fill descriptions, docs, logo, tags and Website.
3. Test the real gateway: search/pagination, encoded asset IDs, metadata and both native SVG/PNG downloads. Verify it calls the live origin rather than a mock.
4. Check the free plan, no charged overage, correct base URL and successful health check.
5. Finish any required account/legal consent with the account owner's confirmation at that step.
6. Publish; verify the anonymous listing, actual link destinations and free badge. Record its real listing URL and gateway host before announcing it.

## What the free API returns to Shirt Lab

- The Website field links to the canonical Asset Wiki.
- The description and About docs link to the Wiki, API documentation, Studio and source code.
- Every result includes a canonical `url` and a `shirtUrl` that integrations can display.
- The card recipe preserves artist credit while helping users discover Shirt Lab.
- RapidAPI's provider analytics can show gateway adoption after publication. Search rankings and followed backlinks depend on the platform and search engines; verify actual public link attributes before claiming SEO value.

The listing files are prepared materials, not evidence that a marketplace listing exists. Keep a separate operational status receipt with the real publication state.
