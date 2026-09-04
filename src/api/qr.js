import { PostRequest } from './client'
import { qrApiKey, urls } from './config'
import { dedupeInFlight } from '../lib/dedupeRequest'

const QR_CACHE_PREFIX = 'mt:qr:v1:'
const memoryCache = new Map()

function cacheKey(bookingId) {
  return `${QR_CACHE_PREFIX}${String(bookingId)}`
}

function readQrCache(bookingId) {
  const id = String(bookingId)
  if (memoryCache.has(id)) return memoryCache.get(id)

  try {
    const raw = sessionStorage.getItem(cacheKey(id))
    if (!raw) return null
    const normalized = normalizeQrResponse(JSON.parse(raw))
    if (normalized.qrImage || normalized.qrString) {
      memoryCache.set(id, normalized)
      return normalized
    }
  } catch {
    /* ignore quota / parse errors */
  }
  return null
}

function writeQrCache(bookingId, normalized) {
  const id = String(bookingId)
  memoryCache.set(id, normalized)

  try {
    sessionStorage.setItem(
      cacheKey(id),
      JSON.stringify({
        order_id: normalized.bookingId,
        booking_id: normalized.bookingId,
        qr_string: normalized.qrString,
        qrImage: normalized.qrImage,
        qr_image: normalized.qrImage,
        valid_until: normalized.validUntil,
        qr_generation_timestamp: normalized.generatedAt,
      }),
    )
  } catch {
    /* sessionStorage full — memory cache still works */
  }
}

/**
 * POST /qr/generate/v2 — returns qr_string and/or qrImage (data URL).
 * Cached by booking_id (memory + sessionStorage). Pass `forceRefresh: true` for Refresh QR.
 */
export async function generateBookingQr(bookingId, { signal, forceRefresh = false } = {}) {
  if (!urls.qrGenerate) {
    throw new Error('QR API URL is not configured (VITE_QR_BASE_URL)')
  }
  if (!qrApiKey) {
    throw new Error('Missing VITE_QR_API_KEY')
  }
  if (!bookingId) {
    throw new Error('booking_id is required')
  }

  const id = String(bookingId)

  if (!forceRefresh) {
    const cached = readQrCache(id)
    if (cached?.qrImage || cached?.qrString) return cached
  }

  return dedupeInFlight(`qr:${id}:${forceRefresh ? 'refresh' : 'load'}`, async () => {
    if (!forceRefresh) {
      const cached = readQrCache(id)
      if (cached?.qrImage || cached?.qrString) return cached
    }

    if (import.meta.env.DEV) {
      console.info('[qr] POST', urls.qrGenerate, { booking_id: id, forceRefresh })
    }

    const data = await PostRequest(
      urls.qrGenerate,
      { booking_id: id },
      {
        signal,
        headers: { 'X-API-Key': qrApiKey },
      },
    )

    const normalized = normalizeQrResponse(data)
    writeQrCache(id, normalized)
    return normalized
  })
}

export function peekCachedBookingQr(bookingId) {
  if (!bookingId) return null
  return readQrCache(bookingId)
}

export function normalizeQrResponse(data) {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid QR response')
  }

  return {
    bookingId: data.order_id ?? data.booking_id ?? null,
    qrString: data.qr_string ?? data.qrString ?? null,
    qrImage: data.qrImage ?? data.qr_image ?? null,
    validUntil: data.valid_until ?? data.validUntil ?? null,
    generatedAt: data.qr_generation_timestamp ?? null,
    raw: data,
  }
}
