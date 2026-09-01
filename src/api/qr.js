import { PostRequest } from './client'
import { qrApiKey, urls } from './config'
import { dedupeInFlight } from '../lib/dedupeRequest'

/**
 * POST /qr/generate/v2 — returns qr_string and/or qrImage (data URL).
 */
export async function generateBookingQr(bookingId, { signal } = {}) {
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

  return dedupeInFlight(`qr:${id}`, async () => {
    const data = await PostRequest(
      urls.qrGenerate,
      { booking_id: id },
      {
        signal,
        headers: { 'X-API-Key': qrApiKey },
      },
    )

    return normalizeQrResponse(data)
  })
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
