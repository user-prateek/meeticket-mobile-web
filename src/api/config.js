function envUrl(value) {
  return String(value || '').trim().replace(/\/$/, '')
}

export const baseUrl = envUrl(import.meta.env.VITE_METRO_BASE_URL)
export const tgsrtcBaseUrl = envUrl(import.meta.env.VITE_TGSRTC_BASE_URL)
/** Multimodal mix engine (metro + bus in one itinerary). */
export const mixBaseUrl = envUrl(import.meta.env.VITE_MIX_BASE_URL)

const ordersDirectBaseUrl = envUrl(import.meta.env.VITE_ORDERS_BASE_URL)
/** Dev: `/orders-api` is proxied to VITE_ORDERS_BASE_URL (vite.config.js) — required for CORS. */
export const ordersBaseUrl = ordersDirectBaseUrl
export const ordersApiKey = import.meta.env.VITE_ORDERS_API_KEY || ''

/**
 * Ola Ride Availability / Estimate API.
 * Auth: Authorization Bearer = journey query token in jotai.
 * x-app-token = VITE_OLA_CLIENT_ID.
 * Direct browser calls (CORS on server). Restart `npm run dev` after env changes.
 */
export const olaBaseUrl = envUrl(import.meta.env.VITE_OLA_BASE_URL)
/** Bearer token — env fallback when the user has not completed Ola OAuth. */
export const olaAccessToken = import.meta.env.VITE_OLA_ACCESS_TOKEN || ''
/** Optional Ola partner affiliate uid for bookings/create. Backend may also fill this. */
export const olaAffiliateUid = String(import.meta.env.VITE_OLA_AFFILIATE_UID || '').trim()
/**
 * Ola user OAuth (implicit): open authorize URL, callback returns #access_token=.
 * Redirect URI is the registered journey path.
 */
export const olaOauthAuthorizeUrl = envUrl(import.meta.env.VITE_OLA_OAUTH_AUTHORIZE_URL)
export const olaOauthClientId = String(
  import.meta.env.VITE_OLA_CLIENT_ID || 'MjY4YWEwNDUtNWY3Ni00NmI2LTk4OWYtZDRmOGNhOWYyN2Zi',
).trim()
export const olaOauthScope = String(import.meta.env.VITE_OLA_OAUTH_SCOPE || 'profile booking').trim()
/** Registered callback. Must match Ola whitelist exactly. `state` is generated per attempt. */
export const olaOauthRedirectUri = String(import.meta.env.VITE_OLA_OAUTH_REDIRECT_URI || '').trim()

/**
 * Refex MeeTicket API host (staging/production).
 * Set VITE_REFEX_BASE_URL — no trailing slash.
 * Paths: {host}/thirdparty/v1/api/meeticket/{search|payment}
 *
 * Dev: browser calls `/refex-api` → Vite proxy → VITE_REFEX_BASE_URL (CORS).
 * Restart `npm run dev` after changing VITE_REFEX_BASE_URL.
 */
const refexDirectBaseUrl = envUrl(import.meta.env.VITE_REFEX_BASE_URL)
export const refexBaseUrl =
  import.meta.env.DEV && refexDirectBaseUrl ? '/refex-api' : refexDirectBaseUrl

/** Issued by Refex per environment. Prefer a backend proxy in production. */
export const refexClientId = import.meta.env.VITE_REFEX_CLIENT_ID || ''
export const refexClientSecret = import.meta.env.VITE_REFEX_CLIENT_SECRET || ''
export const refexVendorId = import.meta.env.VITE_REFEX_VENDOR_ID || ''
export const refexCorporateName = import.meta.env.VITE_REFEX_CORPORATE_NAME || 'Mee Ticket'
export const refexPartnerName =
  import.meta.env.VITE_REFEX_PARTNER_NAME || refexCorporateName || 'Mee Ticket'
/** Temporary Refex StartTime offset (minutes). From `VITE_REFEX_START_OFFSET_MINUTES`; default 0. */
export const refexStartOffsetMinutes = (() => {
  const raw = Number(import.meta.env.VITE_REFEX_START_OFFSET_MINUTES)
  return Number.isFinite(raw) && raw >= 0 ? raw : 0
})()

const refexApiRoot = refexBaseUrl ? `${refexBaseUrl}/thirdparty/v1/api/meeticket` : ''

const qrDirectBaseUrl = envUrl(import.meta.env.VITE_QR_BASE_URL)
/** Dev: `/qr-api` → VITE_QR_BASE_URL (vite.config.js). */
export const qrBaseUrl = import.meta.env.DEV && qrDirectBaseUrl ? '/qr-api' : qrDirectBaseUrl
export const qrApiKey = import.meta.env.VITE_QR_API_KEY || ''
export const helplineNumber = String(import.meta.env.VITE_HELPLINE_NUMBER || '').trim()

/** GET endpoints end with `?`. POST endpoints do not.
 * Metro + TGSRTC journey also send `use_live_distance=true` and
 * `live_distance_provider=google|osrm` from `VITE_MAP_PROVIDER` (see journey.js).
 */
export const urls = {
  journey: `${baseUrl}/journey?`,
  tgsrtcJourney: `${tgsrtcBaseUrl}/journey?`,
  mixJourney: `${mixBaseUrl}/journey?`,
  orders: ordersBaseUrl ? `${ordersBaseUrl}/api/orders` : '',
  olaProducts: olaBaseUrl ? `${olaBaseUrl}/v1/products?` : '',
  refexSearch: refexApiRoot ? `${refexApiRoot}/search` : '',
  refexPayment: refexApiRoot ? `${refexApiRoot}/payment` : '',
  qrGenerate: qrBaseUrl ? `${qrBaseUrl}/qr/generate/v2` : '',
}
