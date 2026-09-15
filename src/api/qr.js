import { PostRequest } from './client'
import { qrApiKey, urls } from './config'
import { dedupeInFlight } from '../lib/dedupeRequest'

const QR_CACHE_PREFIX = 'mt:qr:v1:'
const memoryCache = new Map()

function cacheKey(bookingId) {
  return `${QR_CACHE_PREFIX}${String(bookingId)}`
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function unwrapQrPayload(data) {
  if (!isPlainObject(data)) return {}
  const nested =
    (isPlainObject(data.detail) && data.detail) ||
    (isPlainObject(data.data) && data.data) ||
    (isPlainObject(data.response) && data.response) ||
    (isPlainObject(data.result) && data.result) ||
    (isPlainObject(data.error) && data.error) ||
    (isPlainObject(data.body) && data.body)
  return nested ? { ...data, ...nested } : data
}

function readFlag(value) {
  if (value === true || value === 1 || value === 'true' || value === '1') return true
  if (value === false || value === 0 || value === 'false' || value === '0') return false
  return null
}

function readQrMessage(data) {
  if (!data) return null
  if (typeof data === 'string') {
    const text = data.trim()
    return text && text !== '[object Object]' ? text : null
  }
  if (!isPlainObject(data) && !Array.isArray(data)) return null

  if (Array.isArray(data.detail)) {
    const first = data.detail[0]
    const fromList = readQrMessage(first)
    if (fromList) return fromList
  }

  for (const key of ['message', 'detail', 'error', 'errorMessage', 'msg']) {
    const value = data[key]
    if (typeof value === 'string') {
      const text = value.trim()
      if (text && text !== '[object Object]') return text
    }
    if (isPlainObject(value)) {
      const nested = readQrMessage(value)
      if (nested) return nested
    }
  }
  return null
}

export function isQrConsumedPayload(data) {
  const payload = unwrapQrPayload(data)
  return readFlag(payload.is_consumed) === true || readFlag(payload.isConsumed) === true
}

export class QrConsumedError extends Error {
  constructor(message, body = null) {
    super(message || 'This ticket has been validated.')
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

function resolveQrOutcome(raw, fallbackError) {
  const normalized = normalizeQrResponse(raw)
  if (normalized.consumed) {
    return { kind: 'consumed', normalized }
  }
  if (normalized.qrImage || normalized.qrString) {
    return { kind: 'ready', normalized }
  }
  const message =
    normalized.message ||
    (typeof fallbackError?.message === 'string' && fallbackError.message !== '[object Object]'
      ? fallbackError.message
      : null) ||
    'Could not load QR code'
  return { kind: 'error', normalized, message }
}

/**
 * POST /qr/generate/v2 — returns qr_string and/or qrImage (data URL).
 * Cached by booking_id (memory + sessionStorage). Pass `forceRefresh: true` for Refresh QR.
 *
 * The API body is not stable. Known shapes:
 *   { detail: { message, is_consumed: false } }  → not found / error
 *   { message, is_consumed: true }               → validated
 *   { order_id, qrImage, qr_string, valid_until, is_consumed: false }
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
        cached.message || 'This ticket has been validated.',
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
          cached.message || 'This ticket has been validated.',
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
      const outcome = resolveQrOutcome(error?.body, error)
      if (outcome.kind === 'consumed') {
        writeQrCache(id, outcome.normalized)
        throw new QrConsumedError(outcome.normalized.message, error?.body)
      }
      if (outcome.kind === 'ready') {
        writeQrCache(id, outcome.normalized)
        return outcome.normalized
      }
      throw new Error(outcome.message)
    }

    const outcome = resolveQrOutcome(data)
    if (outcome.kind === 'consumed') {
      writeQrCache(id, outcome.normalized)
      throw new QrConsumedError(outcome.normalized.message, data)
    }
    if (outcome.kind === 'ready') {
      writeQrCache(id, outcome.normalized)
      return outcome.normalized
    }
    throw new Error(outcome.message)
  })
}

export function peekCachedBookingQr(bookingId) {
  if (!bookingId) return null
  return readQrCache(bookingId)
}

export function normalizeQrResponse(data) {
  if (data == null) {
    return {
      bookingId: null,
      qrString: null,
      qrImage: null,
      validUntil: null,
      generatedAt: null,
      consumed: false,
      message: null,
      raw: data,
    }
  }

  const payload = unwrapQrPayload(data)
  const consumed = isQrConsumedPayload(payload)
  const qrString = payload.qr_string ?? payload.qrString ?? null
  const qrImage = payload.qrImage ?? payload.qr_image ?? payload.qr_code_image ?? null

  return {
    bookingId: payload.order_id ?? payload.booking_id ?? payload.bookingId ?? null,
    qrString: consumed ? null : qrString,
    qrImage: consumed ? null : qrImage,
    validUntil: payload.valid_until ?? payload.validUntil ?? null,
    generatedAt: payload.qr_generation_timestamp ?? payload.generatedAt ?? null,
    consumed,
    message: readQrMessage(payload),
    raw: data,
  }
}
