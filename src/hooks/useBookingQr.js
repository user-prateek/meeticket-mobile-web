import { useCallback, useEffect, useRef, useState } from 'react'
import { generateBookingQr, peekCachedBookingQr } from '../api/qr'

/**
 * Fetch ticket QR for a confirmed booking_reference_number from pg/status.
 * Serves cached QR first; Refresh QR forces a network call and updates the cache.
 */
export function useBookingQr(bookingReferenceNumber) {
  const cached = bookingReferenceNumber ? peekCachedBookingQr(bookingReferenceNumber) : null
  const [state, setState] = useState(() =>
    cached
      ? {
          status: 'ready',
          qrImage: cached.qrImage,
          qrString: cached.qrString,
          validUntil: cached.validUntil,
          error: '',
        }
      : {
          status: 'idle',
          qrImage: null,
          qrString: null,
          validUntil: null,
          error: '',
        },
  )
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
      })
      return undefined
    }

    const forceRefresh = forceRefreshRef.current
    forceRefreshRef.current = false

    if (!forceRefresh) {
      const hit = peekCachedBookingQr(bookingReferenceNumber)
      if (hit?.qrImage || hit?.qrString) {
        setState({
          status: 'ready',
          qrImage: hit.qrImage,
          qrString: hit.qrString,
          validUntil: hit.validUntil,
          error: '',
        })
        return undefined
      }
    }

    const runId = ++runIdRef.current
    setState((prev) => ({
      ...prev,
      status: 'loading',
      error: '',
      // Keep previous QR visible while refreshing so the ticket does not flash empty.
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
        })
      })
      .catch((error) => {
        if (runId !== runIdRef.current) return
        setState((prev) => ({
          status: 'error',
          qrImage: prev.qrImage,
          qrString: prev.qrString,
          validUntil: prev.validUntil,
          error: error?.message || 'Could not load QR code',
        }))
      })

    return undefined
  }, [bookingReferenceNumber, refreshNonce])

  return { ...state, refetch }
}
