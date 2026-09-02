import { useCallback, useEffect, useRef } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { acknowledgePgCallback, getOrderId } from '../api/orders'
import { PaymentRedirectScreen } from '../components/PaymentRedirectScreen'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useJourneyOptionById } from '../hooks/useJourneyOptions'
import { PG_STATUS_POLL_MS, usePgStatusPolling } from '../hooks/usePgStatusPolling'
import { withAppContext } from '../lib/appContext'
import { buildSuccessPath, journeyReturnPath } from '../lib/successUrl'
import { orderAtom, tripAtom } from '../store/journey'
import '../components/PaymentRedirectScreen.css'

const PAYTM_MESSAGE_SOURCE = 'meeticket-paytm'

function notifyParent(eventName, data) {
  if (window.parent === window) return
  window.parent.postMessage({ source: PAYTM_MESSAGE_SOURCE, eventName, data }, window.location.origin)
}

/**
 * /payment/callback?order_id=ORD-…&id={journeyId}
 * Branded landing page after Paytm redirect — hides raw MMTS JSON response.
 */
export function PaymentCallbackPage() {
  const [params] = useSearchParams()
  const navigate = useAppNavigate()
  const storedOrder = useAtomValue(orderAtom)
  const trip = useAtomValue(tripAtom)
  const setOrder = useSetAtom(orderAtom)

  const orderId = params.get('order_id') || params.get('orderId') || getOrderId(storedOrder)
  const journeyId = params.get('id') || storedOrder?.journeyId
  const journey = useJourneyOptionById(journeyId)

  const navigatedRef = useRef(false)
  const notifiedRef = useRef(false)

  useEffect(() => {
    if (!orderId || notifiedRef.current) return
    notifiedRef.current = true
    notifyParent('CALLBACK_RECEIVED', { orderId })
  }, [orderId])

  useEffect(() => {
    if (!orderId) return undefined
    const controller = new AbortController()
    acknowledgePgCallback(orderId, { signal: controller.signal }).catch(() => {})
    return () => controller.abort()
  }, [orderId])

  const goToSuccess = useCallback(
    (pgStatus) => {
      if (navigatedRef.current) return
      navigatedRef.current = true

      const resolvedOrderId = getOrderId(storedOrder) ?? pgStatus?.order_id ?? orderId
      navigate(
        buildSuccessPath({
          orderId: resolvedOrderId,
          returnTo: journeyReturnPath(trip),
          fromCheckout: true,
        }),
        { replace: true },
      )
    },
    [journey?.id, journeyId, navigate, orderId, storedOrder, trip],
  )

  const goToFailed = useCallback(
    (pgStatus) => {
      if (navigatedRef.current) return
      navigatedRef.current = true
      setOrder({ ...storedOrder, pgStatus })
      navigate(`/payment/failed?id=${journeyId ?? journey?.id ?? ''}`, { replace: true })
    },
    [journey?.id, journeyId, navigate, setOrder, storedOrder],
  )

  const onPgUpdate = useCallback(
    (pgStatus) => {
      setOrder((prev) => ({ ...prev, pgStatus }))
    },
    [setOrder],
  )

  usePgStatusPolling(orderId, {
    enabled: Boolean(orderId),
    intervalMs: PG_STATUS_POLL_MS,
    onUpdate: onPgUpdate,
    onPaymentFailed: goToFailed,
    onPaymentSuccess: goToSuccess,
  })

  if (!orderId) {
    return <Navigate to={withAppContext('/journey')} replace />
  }

  return (
    <PaymentRedirectScreen
      title="Payment received"
      message="Please wait while we confirm your booking and redirect you to Mee Ticket."
      orderId={orderId}
    />
  )
}
