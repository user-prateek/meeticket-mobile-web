import { useEffect, useRef } from 'react'
import {
  fetchOrderPgStatus,
  isBookingUnsuccessful,
  isPgPaymentFailed,
  isPgPaymentSuccessful,
  shouldContinuePgPolling,
} from '../api/orders'

export const PG_STATUS_POLL_MS = 10000

/**
 * Poll POST /api/orders/{id}/pg/status until:
 * - payment fails → onPaymentFailed (stop)
 * - payment succeeds → onPaymentSuccess (once)
 * - ispolling false → onPollingComplete (stop)
 *
 * Callbacks and interval are kept in refs so parent re-renders do not restart polling.
 */
export function usePgStatusPolling(
  orderId,
  {
    enabled = true,
    intervalMs = PG_STATUS_POLL_MS,
    onUpdate,
    onPaymentFailed,
    onPaymentSuccess,
    onBookingFailed,
    onPollingComplete,
    onError,
  } = {},
) {
  const paymentSuccessRef = useRef(false)
  const stoppedRef = useRef(false)
  const inFlightRef = useRef(false)
  const timeoutRef = useRef(null)
  const runIdRef = useRef(0)
  const intervalMsRef = useRef(intervalMs)
  const callbacksRef = useRef({
    onUpdate,
    onPaymentFailed,
    onPaymentSuccess,
    onBookingFailed,
    onPollingComplete,
    onError,
  })

  intervalMsRef.current = intervalMs
  callbacksRef.current = {
    onUpdate,
    onPaymentFailed,
    onPaymentSuccess,
    onBookingFailed,
    onPollingComplete,
    onError,
  }

  useEffect(() => {
    paymentSuccessRef.current = false
    stoppedRef.current = false
    inFlightRef.current = false
  }, [orderId])

  useEffect(() => {
    if (!enabled || !orderId) return undefined

    const runId = ++runIdRef.current

    const stop = () => {
      stoppedRef.current = true
      if (timeoutRef.current != null) {
        window.clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }

    const scheduleNext = () => {
      if (stoppedRef.current || runId !== runIdRef.current) return
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null
        tick()
      }, intervalMsRef.current)
    }

    const tick = async () => {
      if (stoppedRef.current || runId !== runIdRef.current || inFlightRef.current) return
      inFlightRef.current = true

      const {
        onUpdate: handleUpdate,
        onPaymentFailed: handlePaymentFailed,
        onPaymentSuccess: handlePaymentSuccess,
        onBookingFailed: handleBookingFailed,
        onPollingComplete: handlePollingComplete,
        onError: handleError,
      } = callbacksRef.current

      try {
        const pgStatus = await fetchOrderPgStatus(orderId)
        if (stoppedRef.current || runId !== runIdRef.current) return

        handleUpdate?.(pgStatus)

        if (isPgPaymentFailed(pgStatus)) {
          stop()
          handlePaymentFailed?.(pgStatus)
          return
        }

        if (isPgPaymentSuccessful(pgStatus) && !paymentSuccessRef.current) {
          paymentSuccessRef.current = true
          handlePaymentSuccess?.(pgStatus)
        }

        if (!shouldContinuePgPolling(pgStatus)) {
          stop()
          if (isPgPaymentSuccessful(pgStatus) && isBookingUnsuccessful(pgStatus)) {
            handleBookingFailed?.(pgStatus)
          } else {
            handlePollingComplete?.(pgStatus)
          }
          return
        }

        scheduleNext()
      } catch (error) {
        if (stoppedRef.current || runId !== runIdRef.current) return
        if (import.meta.env.DEV) console.warn('[pg/status] poll failed', error)
        handleError?.(error)
        if (!stoppedRef.current) scheduleNext()
      } finally {
        inFlightRef.current = false
      }
    }

    stoppedRef.current = false
    tick()

    return () => {
      stop()
    }
  }, [enabled, orderId])
}
