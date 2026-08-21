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

## Run

```bash
npm install
npm run dev
```

`/` opens a demo `/journey?...` for local testing. Host apps should deep-link straight to `/journey` with coords.
