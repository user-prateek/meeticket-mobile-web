import { PostRequest } from './client'
import { ordersApiKey, ordersBaseUrl } from './config'
import { storeOlaAccessToken } from '../lib/olaToken'

function ordersAuthHeaders() {
  if (!ordersApiKey) {
    throw new Error('Missing VITE_ORDERS_API_KEY')
  }
  return { 'X-API-Key': ordersApiKey }
}

/** Ola token APIs are keyed by mobile (digits). Prefer last 10 for +91 numbers. */
export function olaTokenMobile(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length > 10 && digits.startsWith('91')) return digits.slice(-10)
  return digits
}

export function olaTokenUrl(mobile) {
  const id = olaTokenMobile(mobile)
  if (!ordersBaseUrl || !id) return ''
  return `${ordersBaseUrl}/api/ola/tokens/${encodeURIComponent(id)}`
}

export function readOlaTokenFromResponse(data) {
  if (!data || typeof data !== 'object') return null
  const accessToken = String(data.access_token || data.accessToken || '').trim()
  if (!accessToken) return null
  const expiresIn = Number(data.expires_in ?? data.expiresIn)
  return {
    accessToken,
    expiresIn: Number.isFinite(expiresIn) && expiresIn > 0 ? expiresIn : null,
    mobile: data.mobile || null,
  }
}

/** GET /api/ola/tokens/{mobile} */
export async function fetchOlaAccessToken(mobile, { signal } = {}) {
  const url = olaTokenUrl(mobile)
  if (!url) throw new Error('Ola token URL is not configured')

  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json', ...ordersAuthHeaders() },
    signal,
  })
  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = null
  }

  if (response.status === 404) return null
  if (!response.ok) {
    const err = new Error(
      (data && typeof data === 'object' && (data.error || data.message)) ||
        text?.slice(0, 200) ||
        `Request failed (${response.status})`,
    )
    err.status = response.status
    err.body = data
    throw err
  }

  return readOlaTokenFromResponse(data)
}

/** PUT /api/ola/tokens/{mobile}  { access_token, expires_in } */
export async function saveOlaAccessToken(
  mobile,
  { accessToken, expiresIn } = {},
  { signal } = {},
) {
  const url = olaTokenUrl(mobile)
  if (!url) throw new Error('Ola token URL is not configured')
  const token = String(accessToken || '').trim()
  if (!token) throw new Error('Ola access token is missing')

  const payload = { access_token: token }
  const seconds = Number(expiresIn)
  if (Number.isFinite(seconds) && seconds > 0) payload.expires_in = seconds

  const data = await PostRequest(url, payload, {
    signal,
    method: 'PUT',
    headers: ordersAuthHeaders(),
  })

  storeOlaAccessToken({ accessToken: token, expiresIn })
  return data
}
