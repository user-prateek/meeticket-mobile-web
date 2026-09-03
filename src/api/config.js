export const baseUrl = 'https://metrommdl.iamgds.com'
export const tgsrtcBaseUrl = 'https://tgsrtcengine.iamgds.com'

const ordersDirectBaseUrl = (import.meta.env.VITE_ORDERS_BASE_URL || 'https://mmts.iamgds.com').replace(
  /\/$/,
  '',
)
/** Dev: `/orders-api` is proxied to VITE_ORDERS_BASE_URL (vite.config.js) — required for CORS. */
export const ordersBaseUrl = ordersDirectBaseUrl
export const ordersApiKey = import.meta.env.VITE_ORDERS_API_KEY || ''

/**
 * Ola Ride Availability / Estimate API.
 * Sandbox: https://devapi-stg.olacabs-dev.in/mock  (default for local)
 * Prod/dev API: https://devapi.olacabs.com
 * Always uses the direct base URL (no Vite proxy) — set VITE_OLA_BASE_URL.
 * Set VITE_OLA_APP_TOKEN (+ optional VITE_OLA_ACCESS_TOKEN).
 * Restart `npm run dev` after changing Ola env vars.
 */
export const olaBaseUrl = (
  import.meta.env.VITE_OLA_BASE_URL || 'https://devapi-stg.olacabs-dev.in/mock'
).replace(/\/$/, '')
export const olaAppToken = import.meta.env.VITE_OLA_APP_TOKEN || ''
/** Optional user Bearer token — only sent when set. */
export const olaAccessToken = import.meta.env.VITE_OLA_ACCESS_TOKEN || ''

/**
 * Refex MeeTicket API host (staging/production).
 * Set VITE_REFEX_BASE_URL — no trailing slash.
 * Staging: https://auxilium.staging.tracking.refexmobility.com
 * Paths: {host}/thirdparty/v1/api/meeticket/{search|payment}
 *
 * Dev: browser calls `/refex-api` → Vite proxy → VITE_REFEX_BASE_URL (CORS).
 * Restart `npm run dev` after changing VITE_REFEX_BASE_URL.
 */
const refexDirectBaseUrl = (import.meta.env.VITE_REFEX_BASE_URL || '').replace(/\/$/, '')
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

const qrDirectBaseUrl = (import.meta.env.VITE_QR_BASE_URL || 'https://meeticketqr.iamgds.com').replace(
  /\/$/,
  '',
)
/** Dev: `/qr-api` → VITE_QR_BASE_URL (vite.config.js). */
export const qrBaseUrl = import.meta.env.DEV && qrDirectBaseUrl ? '/qr-api' : qrDirectBaseUrl
export const qrApiKey = import.meta.env.VITE_QR_API_KEY || ''
export const helplineNumber = String(import.meta.env.VITE_HELPLINE_NUMBER || '').trim()

/** GET endpoints end with `?`. POST endpoints do not. */
export const urls = {
  journey: `${baseUrl}/journey?`,
  tgsrtcJourney: `${tgsrtcBaseUrl}/journey?`,
  orders: ordersBaseUrl ? `${ordersBaseUrl}/api/orders` : '',
  olaProducts: olaBaseUrl ? `${olaBaseUrl}/v1/products?` : '',
  refexSearch: refexApiRoot ? `${refexApiRoot}/search` : '',
  refexPayment: refexApiRoot ? `${refexApiRoot}/payment` : '',
  qrGenerate: qrBaseUrl ? `${qrBaseUrl}/qr/generate/v2` : '',
}
