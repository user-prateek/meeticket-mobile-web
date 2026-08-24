# Meeticket Mobile Web

Mobile web for multimodal trips **A → B**.

## Routes

| Path | Role |
| --- | --- |
| `/journey?...` | Options list — **requires** `from_lat`, `from_lon`, `to_lat`, `to_lon` |
| `/journey-detail?id=1` | Detail for option `1` from Jotai list |
| `/cab?id=1&service=pickup` | First/last mile (cab) |
| `/success?id=1` | Booking confirm / QR |

```
/journey → /journey-detail?id=N → /cab?id=N → /success?id=N
```

Option ids are integers `1, 2, 3…` assigned when mapping the API response into Jotai.

## Journey query

```
/journey?from_lat=17.404897799573&from_lon=78.4655127838186
  &to_lat=17.4184128072581&to_lon=78.49696327420617
  &access_mode=walk&egress_mode=walk&candidates=2
```

## API

```js
// src/api/config.js
export const baseUrl = 'https://metrommdl.iamgds.com'
export const urls = { journey: `${baseUrl}/journey?` }
```

Calls go directly to the API host (CORS handled on the backend).

## Cab map (Google Maps)

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
