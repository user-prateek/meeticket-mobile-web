# Meeticket Mobile Web

Mobile web for multimodal trips **A → B**.

## Routes

| Path | Role |
| --- | --- |
| `/journey?...` | Options list — **requires** `from_lat`, `from_lon`, `to_lat`, `to_lon` |
| `/journey-detail?id=1` | Detail for option `1` from Jotai list |
| `/ride?...` | Cab-only home — pick Ola / Rapido / Refex (no metro token) |
| `/cab?id=1&service=pickup` | First/last mile (cab) from a journey option |
| `/cab?direct=1&provider=ola&from_lat=…` | Door-to-door cab from `/ride` |
| `/success?order=ORD-…` | Booking confirm / QR |

```
/journey → /journey-detail?id=N → /cab?id=N → /success?order=ORD-…
/ride → /cab?direct=1&provider=… → /payment → /success?order=ORD-…
```

Option ids are integers `1, 2, 3…` assigned when mapping the API response into Jotai.

## Journey query

```
/journey?from_lat=…&from_lon=…&to_lat=…&to_lon=…
  &access_mode=walk&egress_mode=walk&candidates=2
```

## Cab-only query (`/ride`)

Same pickup/drop coords and user fields as `/journey`, **without** `mbt` (metro token) or product `mode`.

```
/ride?from_lat=…&from_lon=…&to_lat=…&to_lon=…&from=…&to=…
  &user_id=…&mobile=…&name=…&email=…
  &src=android&versionName=1.0.0
```

## Ola user OAuth

Triggered when the user checks **Need a ride** and taps **Ola** on `/journey` or `/journey-detail` (same for Ola on `/ride`):

1. If an Ola token is already in session (including Android `?access_token=`), use it.
2. Else `GET /api/ola/tokens/{mobile}` — reuse a stored token if present.
3. Else open Ola authorize. `redirect_uri` is the registered callback `https://mmtsjp.iamgds.com/journey`, percent-encoded. `scope=profile booking` and a new `state` are separate parameters, not part of that URI.
4. Ola returns to `https://mmtsjp.iamgds.com/journey#access_token=…&state=…&scope=profile%20booking&token_type=bearer&expires_in=…`. The app keeps the token only when `state` matches, then `PUT /api/ola/tokens/{mobile}` `{ access_token, expires_in }`.

`GET /v1/products` sends `Authorization: Bearer` from the journey query token and `x-app-token` from `VITE_OLA_CLIENT_ID`. That same client id is used on the authorize URL with `VITE_OLA_OAUTH_AUTHORIZE_URL`. Include `mobile` on the entry URL.

## API

```js
// src/api/config.js
export const baseUrl = 'https://metrommdl.iamgds.com'
export const urls = { journey: `${baseUrl}/journey?` }
```

Calls go directly to the API host (CORS handled on the backend).

## WebView (Android / iOS)

Entry example:

```
/journey?from_lat=…&from_lon=…&to_lat=…&to_lon=…&from=…&to=…
  &access_mode=walk&egress_mode=walk&candidates=2
  &src=android&versionName=1.2.3
```

- `src` + `versionName` are stored and **appended on every navigation** (`/journey-detail`, `/cab`, `/success`, …).
- Back on the journey list goes to **`/gotohome`** (empty page). The native app should intercept that URL and close the WebView / show native home.


On `/cab?id=2&service=pickup|drop`:

- `id` → journey option from Jotai
- `pickup` → `access` lat/lng (first mile)
- `drop` → `egress` lat/lng (last mile)

`import.meta.env.VITE_GOOGLE_MAPS_API_KEY` and `VITE_MAP_PROVIDER` are **inlined at build time** by Vite.  
Nginx/pm2 serving `dist/` does **not** read `.env` or bashrc at request time.

### Map provider (`osm` default, or `google`)

Google Maps JavaScript **Dynamic Maps** and **Directions** are billed (10k free loads/requests per month, then paid). The cab page needs a custom route + markers, so **OSM is the default**. Set `VITE_MAP_PROVIDER=google` only if you have a billed Google key.

`.env` in the project root (gitignored):

```
# osm (default) | google
VITE_MAP_PROVIDER=osm

# Only required when VITE_MAP_PROVIDER=google
# VITE_GOOGLE_MAPS_API_KEY=your_key_here

# Optional OSM overrides (defaults are public OSM / OSRM / Nominatim)
# VITE_OSM_TILE_URL=https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png
# VITE_OSM_ROUTER_URL=https://router.project-osrm.org
# VITE_OSM_NOMINATIM_URL=https://nominatim.openstreetmap.org
```

Then `npm run dev` (restart after changing `.env`).

`osm` uses Leaflet + OpenStreetMap tiles, OSRM for driving routes/ETA, and Nominatim for reverse geocode. `google` uses Maps JavaScript + Directions + Geocoder. Map Guide “View” opens OpenStreetMap or Google Maps directions to match the provider.

### Local development (OSM, default)

No Google key needed. Unset `VITE_MAP_PROVIDER` or set `VITE_MAP_PROVIDER=osm`.

### Local development (Google)

```
VITE_MAP_PROVIDER=google
VITE_GOOGLE_MAPS_API_KEY=your_key_here
```

### Production / release (no `.env` in the repo)

Export the variable **before** `npm run build` on the build machine:

```bash
# one-shot
export VITE_GOOGLE_MAPS_API_KEY=your_key_here
git clone …
npm ci
npm run build
# symlink dist → nginx/pm2

# or one line:
VITE_MAP_PROVIDER=osm npm run build
# Google (billed Maps JS + Directions):
VITE_MAP_PROVIDER=google VITE_GOOGLE_MAPS_API_KEY=your_key_here npm run build
```

To avoid typing it each release, put the same `export` in the deploy user’s `~/.bashrc` / `~/.profile` (or your CI secrets) so the shell that runs `npm run build` already has it.

Enable **Maps JavaScript API** + **Directions API**, and restrict the key by HTTP referrer in Google Cloud.

