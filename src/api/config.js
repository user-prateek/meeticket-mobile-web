export const baseUrl = 'https://metrommdl.iamgds.com'

/**
 * Refex MeeTicket API host (staging/production).
 * Set VITE_REFEX_BASE_URL — no trailing slash.
 * Paths: {host}/thirdparty/v1/api/meeticket/{search|block-cab|payment}
 *
 * Dev: `/refex-api` is proxied to VITE_REFEX_BASE_URL (vite.config.js) — required for CORS.
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

const refexApiRoot = refexBaseUrl ? `${refexBaseUrl}/thirdparty/v1/api/meeticket` : ''

/** GET endpoints end with `?`. POST endpoints do not. */
export const urls = {
  journey: `${baseUrl}/journey?`,
  refexSearch: refexApiRoot ? `${refexApiRoot}/search` : '',
  refexBlockCab: refexApiRoot ? `${refexApiRoot}/block-cab` : '',
  refexPayment: refexApiRoot ? `${refexApiRoot}/payment` : '',
}
