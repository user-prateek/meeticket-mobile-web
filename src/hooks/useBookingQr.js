import { useCallback, useEffect, useRef, useState } from 'react'
import { generateBookingQr, peekCachedBookingQr } from '../api/qr'

/**
 * Fetch ticket QR for a confirmed booking_reference_number from pg/status.
 * Serves cached QR first; Refresh QR forces a network call and updates the cache.
 * `is_consumed: true` from QR API → status `consumed` (validated / already used).
 */
export function useBookingQr(bookingReferenceNumber) {
  const cached = bookingReferenceNumber ? peekCachedBookingQr(bookingReferenceNumber) : null
  const [state, setState] = useState(() => {
    if (cached?.consumed) {
      return {
        status: 'consumed',
        qrImage: null,
        qrString: null,
        validUntil: cached.validUntil,
        error: cached.message || 'This ticket cannot be used now.',
        consumed: true,
      }
    }
    if (cached) {
      return {
        status: 'ready',
        qrImage: cached.qrImage,
        qrString: cached.qrString,
        validUntil: cached.validUntil,
        error: '',
        consumed: false,
      }
    }
    return {
      status: 'idle',
      qrImage: null,
      qrString: null,
      validUntil: null,
      error: '',
      consumed: false,
    }
  })
  const [refreshNonce, setRefreshNonce] = useState(0)
  const forceRefreshRef = useRef(false)
  const runIdRef = useRef(0)

  const refetch = useCallback(() => {
    forceRefreshRef.current = true
    setRefreshNonce((value) => value + 1)
  }, [])

  useEffect(() => {
    if (!bookingReferenceNumber) {
      setState({
        status: 'idle',
        qrImage: null,
        qrString: null,
        validUntil: null,
        error: '',
        consumed: false,
      })
      return undefined
    }

    const forceRefresh = forceRefreshRef.current
    forceRefreshRef.current = false

    if (!forceRefresh) {
      const hit = peekCachedBookingQr(bookingReferenceNumber)
      if (hit?.consumed) {
        setState({
          status: 'consumed',
          qrImage: null,
          qrString: null,
          validUntil: hit.validUntil,
          error: hit.message || 'This ticket cannot be used now.',
          consumed: true,
        })
        return undefined
      }
      if (hit?.qrImage || hit?.qrString) {
        setState({
          status: 'ready',
          qrImage: hit.qrImage,
          qrString: hit.qrString,
          validUntil: hit.validUntil,
          error: '',
          consumed: false,
        })
        return undefined
      }
    }

    const runId = ++runIdRef.current
    setState((prev) => ({
      ...prev,
      status: 'loading',
      error: '',
      consumed: false,
      qrImage: forceRefresh ? prev.qrImage : null,
      qrString: forceRefresh ? prev.qrString : null,
    }))

    generateBookingQr(bookingReferenceNumber, { forceRefresh })
      .then((result) => {
        if (runId !== runIdRef.current) return
        setState({
          status: 'ready',
          qrImage: result.qrImage,
          qrString: result.qrString,
          validUntil: result.validUntil,
          error: '',
          consumed: false,
        })
      })
      .catch((error) => {
        if (runId !== runIdRef.current) return
        if (error?.consumed || error?.name === 'QrConsumedError') {
          setState({
            status: 'consumed',
            qrImage: null,
            qrString: null,
            validUntil: null,
            error: error?.message || 'This ticket cannot be used now.',
            consumed: true,
          })
          return
        }
        setState((prev) => ({
          status: 'error',
          qrImage: prev.qrImage,
          qrString: prev.qrString,
          validUntil: prev.validUntil,
          error: error?.message || 'Could not load QR code',
          consumed: false,
        }))
      })

    return undefined
  }, [bookingReferenceNumber, refreshNonce])

  return { ...state, refetch }
}
