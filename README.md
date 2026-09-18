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
3. Else open Ola authorize with `redirect_uri` = the **current page**.
4. Ola returns `#access_token=…&expires_in=…`; then `PUT /api/ola/tokens/{mobile}` `{ access_token, expires_in }`.

Authorize URL uses `VITE_OLA_CLIENT_ID` + `VITE_OLA_OAUTH_AUTHORIZE_URL`. Include `mobile` on the entry URL.

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

`import.meta.env.VITE_GOOGLE_MAPS_API_KEY` is **inlined at build time** by Vite.  
Nginx/pm2 serving `dist/` does **not** read `.env` or bashrc at request time.

### Local development

`.env` in the project root (gitignored):

```
VITE_GOOGLE_MAPS_API_KEY=your_key_here
```

Then `npm run dev` (restart after changing `.env`).

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
VITE_GOOGLE_MAPS_API_KEY=your_key_here npm run build
```

To avoid typing it each release, put the same `export` in the deploy user’s `~/.bashrc` / `~/.profile` (or your CI secrets) so the shell that runs `npm run build` already has it.

Enable **Maps JavaScript API** + **Directions API**, and restrict the key by HTTP referrer in Google Cloud.

