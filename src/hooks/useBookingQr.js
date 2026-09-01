import { useCallback, useEffect, useRef, useState } from 'react'
import { generateBookingQr } from '../api/qr'

/**
 * Fetch ticket QR for a confirmed booking_reference_number from pg/status.
 */
export function useBookingQr(bookingReferenceNumber) {
  const [state, setState] = useState({
    status: 'idle',
    qrImage: null,
    qrString: null,
    validUntil: null,
    error: '',
  })
  const [refreshNonce, setRefreshNonce] = useState(0)
  const runIdRef = useRef(0)

  const refetch = useCallback(() => {
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

    const runId = ++runIdRef.current
    setState((prev) => ({ ...prev, status: 'loading', error: '' }))

    generateBookingQr(bookingReferenceNumber)
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
        setState({
          status: 'error',
          qrImage: null,
          qrString: null,
          validUntil: null,
          error: error?.message || 'Could not load QR code',
        })
      })

    return undefined
  }, [bookingReferenceNumber, refreshNonce])

  return { ...state, refetch }
}
