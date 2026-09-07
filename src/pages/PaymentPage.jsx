import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAtomValue, useSetAtom } from 'jotai'
import { Header } from '../components/Header'
import { PaymentRedirectScreen } from '../components/PaymentRedirectScreen'
import { getOrderId, getPaytmPgData, isPgPaymentFailed } from '../api/orders'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useJourneyOptionById } from '../hooks/useJourneyOptions'
import { PG_STATUS_POLL_MS, usePgStatusPolling } from '../hooks/usePgStatusPolling'
import { buildPaymentCallbackUrl } from '../lib/paymentCallback'
import { buildSuccessPath } from '../lib/successUrl'
import { withAppContext } from '../lib/appContext'
import {
  isPaytmParentMessage,
  PAYTM_CLOSED_EVENTS,
  PAYTM_FAILURE_EVENTS,
  PAYTM_SUCCESS_EVENTS,
} from '../lib/paytmCheckout'
import { tripToSearch } from '../lib/tripQuery'
import { lastMileSelectionAtom, orderAtom, tripAtom } from '../store/journey'
import '../components/PaymentRedirectScreen.css'
import './PaymentPage.css'

/**
 * /payment?id=1
 * Paytm checkout + poll until payment succeeds or fails.
 * Leg booking continues on /success while ispolling is true.
 */
export function PaymentPage() {
  const [params] = useSearchParams()
  const navigate = useAppNavigate()
  const trip = useAtomValue(tripAtom)
  const storedOrder = useAtomValue(orderAtom)
  const lastMile = useAtomValue(lastMileSelectionAtom)
  const setOrder = useSetAtom(orderAtom)

  const journeyId = params.get('id')
  const journey = useJourneyOptionById(journeyId)

  const orderId = getOrderId(storedOrder)
  const pg = useMemo(() => getPaytmPgData(storedOrder?.pgInitiate), [storedOrder?.pgInitiate])
  const checkoutSrc = useMemo(() => withAppContext('/payment/checkout'), [])

  const [error, setError] = useState('')
  const [pollingActive, setPollingActive] = useState(true)
  const [processingPayment, setProcessingPayment] = useState(false)
  const navigatedRef = useRef(false)
  const iframeLoadsRef = useRef(0)

  useEffect(() => {
    if (!orderId || !import.meta.env.DEV) return
    console.info('[payment] Preferred Paytm callback URL:', buildPaymentCallbackUrl(orderId, { journeyId: journey?.id }))
  }, [journey?.id, orderId])

  const beginProcessing = useCallback(() => {
    setProcessingPayment(true)
    setPollingActive(true)
  }, [])

  const goToSuccess = useCallback(
    (pgStatus) => {
      if (navigatedRef.current) return
      navigatedRef.current = true
      setPollingActive(false)

      const resolvedOrderId = getOrderId(storedOrder) ?? pgStatus?.order_id
      navigate(
        buildSuccessPath({
          orderId: resolvedOrderId,
        }),
        { replace: true },
      )
    },
    [navigate, storedOrder],
  )

  const goToFailed = useCallback(
    (pgStatus) => {
      if (navigatedRef.current) return
      navigatedRef.current = true
      setPollingActive(false)
      setOrder({ ...storedOrder, pgStatus })
      navigate(`/payment/failed?id=${journey?.id ?? journeyId}`, { replace: true })
    },
    [journey?.id, journeyId, navigate, setOrder, storedOrder],
  )

  const onPgUpdate = useCallback(
    (pgStatus) => {
      if (isPgPaymentFailed(pgStatus)) return
      setOrder((prev) => ({ ...prev, pgStatus }))
    },
    [setOrder],
  )

  usePgStatusPolling(orderId, {
    enabled: Boolean(orderId) && pollingActive,
    intervalMs: processingPayment ? 2000 : PG_STATUS_POLL_MS,
    onUpdate: onPgUpdate,
    onPaymentFailed: goToFailed,
    onPaymentSuccess: goToSuccess,
  })

  useEffect(() => {
    function onPaytmMessage(event) {
      if (!isPaytmParentMessage(event) || !orderId || navigatedRef.current) return

      const { eventName } = event.data
      if (PAYTM_SUCCESS_EVENTS.has(eventName) || PAYTM_FAILURE_EVENTS.has(eventName)) {
        beginProcessing()
        return
      }
      if (PAYTM_CLOSED_EVENTS.has(eventName)) {
        setError('Payment window closed before completion.')
      }
    }

    window.addEventListener('message', onPaytmMessage)
    return () => window.removeEventListener('message', onPaytmMessage)
  }, [beginProcessing, orderId])

  function onCheckoutFrameLoad() {
    iframeLoadsRef.current += 1
    if (iframeLoadsRef.current > 1) {
      beginProcessing()
    }
  }

  if (!journey) {
    const fallback = trip ? `/journey${tripToSearch(trip)}` : '/journey'
    return <Navigate to={withAppContext(fallback)} replace />
  }

  if (!storedOrder?.pgInitiate || !pg.checkoutJsUrl) {
    return <Navigate to={withAppContext(`/journey-detail?id=${journey.id}`)} replace />
  }

  function backToDetail() {
    const next = new URLSearchParams({ id: String(journey.id) })
    if (lastMile?.providerId) next.set('provider', lastMile.providerId)
    if (lastMile?.modeId) next.set('mode', lastMile.modeId)
    if (lastMile?.vehicleId) next.set('vehicle', lastMile.vehicleId)
    navigate(`/journey-detail?${next.toString()}`)
  }

  return (
    <section className="mt-payment-page">
      <Header title="Complete Payment" onBack={backToDetail} />

      <div className="mt-payment-page__summary">
        <p>
          Order <strong>{orderId}</strong>
        </p>
        <p>
          Amount <strong>₹{pg.amount}</strong>
        </p>
        <p className="mt-payment-page__hint">Complete payment in Paytm below.</p>
        {error ? <p className="mt-payment-page__error">{error}</p> : null}
      </div>

      <div className={`mt-payment-page__frame-wrap${processingPayment ? ' is-processing' : ''}`}>
        {processingPayment ? (
          <div className="mt-payment-page__processing">
            <PaymentRedirectScreen
              compact
              title="Payment received"
              message="Confirming your payment and redirecting to Mee Ticket…"
              orderId={orderId}
            />
          </div>
        ) : null}
        <iframe
          className="mt-payment-page__frame"
          title="Paytm checkout"
          src={checkoutSrc}
          allow="payment *"
          onLoad={onCheckoutFrameLoad}
        />
      </div>
    </section>
  )
}
