import { PostRequest } from './client'
import { qrApiKey, urls } from './config'
import { dedupeInFlight } from '../lib/dedupeRequest'

const QR_CACHE_PREFIX = 'mt:qr:v1:'
const memoryCache = new Map()

function cacheKey(bookingId) {
  return `${QR_CACHE_PREFIX}${String(bookingId)}`
}

export function isQrConsumedPayload(data) {
  if (!data || typeof data !== 'object') return false
  return (
    data.is_consumed === true ||
    data.is_consumed === 'true' ||
    data.isConsumed === true ||
    data.isConsumed === 'true'
  )
}

export class QrConsumedError extends Error {
  constructor(message, body = null) {
    super(message || 'This ticket cannot be used now.')
    this.name = 'QrConsumedError'
    this.consumed = true
    this.body = body
  }
}

function readQrCache(bookingId) {
  const id = String(bookingId)
  if (memoryCache.has(id)) return memoryCache.get(id)

  try {
    const raw = sessionStorage.getItem(cacheKey(id))
    if (!raw) return null
    const normalized = normalizeQrResponse(JSON.parse(raw))
    if (normalized.consumed || normalized.qrImage || normalized.qrString) {
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
        is_consumed: normalized.consumed || false,
        message: normalized.message || null,
      }),
    )
  } catch {
    /* sessionStorage full — memory cache still works */
  }
}

/**
 * POST /qr/generate/v2 — returns qr_string and/or qrImage (data URL).
 * Cached by booking_id (memory + sessionStorage). Pass `forceRefresh: true` for Refresh QR.
 * `{ is_consumed: true }` means the ticket is expired / already used.
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
    if (cached?.consumed) {
      throw new QrConsumedError(
        cached.message || 'This ticket cannot be used now.',
        cached.raw || cached,
      )
    }
    if (cached?.qrImage || cached?.qrString) return cached
  }

  return dedupeInFlight(`qr:${id}:${forceRefresh ? 'refresh' : 'load'}`, async () => {
    if (!forceRefresh) {
      const cached = readQrCache(id)
      if (cached?.consumed) {
        throw new QrConsumedError(
          cached.message || 'This ticket cannot be used now.',
          cached.raw || cached,
        )
      }
      if (cached?.qrImage || cached?.qrString) return cached
    }

    if (import.meta.env.DEV) {
      console.info('[qr] POST', urls.qrGenerate, { booking_id: id, forceRefresh })
    }

    let data
    try {
      data = await PostRequest(
        urls.qrGenerate,
        { booking_id: id },
        {
          signal,
          headers: { 'X-API-Key': qrApiKey },
        },
      )
    } catch (error) {
      if (isQrConsumedPayload(error?.body)) {
        const normalized = normalizeQrResponse(error.body)
        writeQrCache(id, normalized)
        throw new QrConsumedError(
          error.body?.message || error.message || 'This ticket cannot be used now.',
          error.body,
        )
      }
      throw error
    }

    if (isQrConsumedPayload(data)) {
      const normalized = normalizeQrResponse(data)
      writeQrCache(id, normalized)
      throw new QrConsumedError(
        data.message || 'This ticket cannot be used now.',
        data,
      )
    }

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

  const consumed = isQrConsumedPayload(data)

  return {
    bookingId: data.order_id ?? data.booking_id ?? null,
    qrString: consumed ? null : data.qr_string ?? data.qrString ?? null,
    qrImage: consumed ? null : data.qrImage ?? data.qr_image ?? null,
    validUntil: data.valid_until ?? data.validUntil ?? null,
    generatedAt: data.qr_generation_timestamp ?? null,
    consumed,
    message: data.message || null,
    raw: data,
  }
}
