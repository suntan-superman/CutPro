# Static Bakersfield service-area map

The homepage, Service Areas index, and Bakersfield service page use the same
`ServiceAreaMap` component and locally hosted `/maps/bakersfield.webp` image.
The roads, river, parks, and place locations come from OpenStreetMap geometry,
not a decorative approximation. The palette matches CutPro's green/cream design.
The Bakersfield marker represents the city, not a business address. No service
radius or guaranteed coverage boundary is drawn.

No Google account, API key, paid map service, iframe, visitor geolocation, or
third-party map request is needed to display the map. Only the optional larger
map/attribution links take visitors to OpenStreetMap. Normal builds are offline
with respect to map data and use the committed asset.

## Attribution and source

Map data © OpenStreetMap contributors, licensed under the
[Open Database License](https://opendatacommons.org/licenses/odbl/1-0/).
Keep the visible attribution link in the shared component. The original extract
(including tags and coordinates) is available at
`/maps/bakersfield-source.json.gz` under that license. Bounds, attribution, and
license are also included in the extract's `cutpro` metadata. See
[OpenStreetMap copyright](https://www.openstreetmap.org/copyright).

The map is rendered from a small, bounded Overpass data query, not downloaded
from OpenStreetMap's public tile service. `scripts/generate-service-map.mjs`
documents the projection, layers, styling, query, and exact bounds.

## Refreshing

Run `node scripts/generate-service-map.mjs` to reproduce the image from the
committed source without network access. To deliberately refresh geographic
data, run `node scripts/generate-service-map.mjs --refresh`. This performs one
bounded request to the public Overpass instance at `overpass.private.coffee`.
Do not add this refresh to CI/builds or a visitor request path.

Inspect `artifacts/bakersfield-map.svg` and the resulting WebP. Confirm the map
labels and highways remain clear at mobile widths. Commit the updated image
and compressed source together. Any change in aspect ratio must also update
the image dimensions in `ServiceAreaMap`.

Validate with `npm run check`, then run
`node scripts/certify-service-map.mjs` against a local production server.
Set `CUTPRO_QA_ORIGIN` to select the server; default is `http://127.0.0.1:3012`.
The same read-only check can verify the existing Netlify deployment after push.

## Initial certification — September 22, 2026

`npm run check` passed (lint, 99 tests, production build). Browser certification
passed on all three map pages at 1440, 768, 390, and 320 pixels: loaded images,
visible attribution, larger-map link, no horizontal overflow, no decorative
map remnants, and no requests to external map providers. Desktop and mobile
screenshots were visually reviewed. No admin, upload, phone configuration, or
DNS changes are part of this feature.
