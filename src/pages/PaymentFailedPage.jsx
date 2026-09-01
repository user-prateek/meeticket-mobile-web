import { Navigate, useSearchParams } from 'react-router-dom'
import { useAtomValue } from 'jotai'
import { Header } from '../components/Header'
import { getOrderId, pgFailureMessage } from '../api/orders'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useJourneyOptionById } from '../hooks/useJourneyOptions'
import { withAppContext } from '../lib/appContext'
import { tripToSearch } from '../lib/tripQuery'
import { lastMileSelectionAtom, orderAtom, tripAtom } from '../store/journey'
import './PaymentPage.css'

const SUPPORT_PHONE = '080-26252625'

/**
 * /payment/failed?id=1 — payment unsuccessful (pg_status failure).
 */
export function PaymentFailedPage() {
  const [params] = useSearchParams()
  const navigate = useAppNavigate()
  const trip = useAtomValue(tripAtom)
  const storedOrder = useAtomValue(orderAtom)
  const lastMile = useAtomValue(lastMileSelectionAtom)

  const journeyId = params.get('id')
  const journey = useJourneyOptionById(journeyId)
  const orderId = getOrderId(storedOrder)
  const message = pgFailureMessage(storedOrder?.pgStatus)

  if (!journey) {
    const fallback = trip ? `/journey${tripToSearch(trip)}` : '/journey'
    return <Navigate to={withAppContext(fallback)} replace />
  }

  function detailPath() {
    const next = new URLSearchParams({ id: String(journey.id) })
    if (lastMile?.providerId) next.set('provider', lastMile.providerId)
    if (lastMile?.modeId) next.set('mode', lastMile.modeId)
    if (lastMile?.vehicleId) next.set('vehicle', lastMile.vehicleId)
    return `/journey-detail?${next.toString()}`
  }

  return (
    <section className="mt-payment-page">
      <Header title="Payment Failed" onBack={() => navigate(detailPath())} />

      <div className="mt-pay-result">
        <div className="mt-pay-result__card mt-pay-result__card--warn">
          <span className="mt-pay-result__icon mt-pay-result__icon--error" aria-hidden="true">
            !
          </span>
          <h2>Payment Unsuccessful</h2>
          <p>{message}</p>
          <p className="mt-pay-result__sub">
            We&apos;re sorry! It seems there is some problem with your payment. You can retry the
            payment or choose another payment option to proceed further.
          </p>
        </div>

        <button type="button" className="mt-pay-result__option" onClick={() => navigate('/journey')}>
          <span className="mt-pay-result__option-icon" aria-hidden="true">
            ⌂
          </span>
          <span>
            <strong>Go to Homepage &amp; initiate a fresh booking</strong>
            <small>Start a new booking from the beginning</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>

        <button type="button" className="mt-pay-result__option" onClick={() => navigate(detailPath())}>
          <span className="mt-pay-result__option-icon" aria-hidden="true">
            💳
          </span>
          <span>
            <strong>Choose another payment option</strong>
            <small>Try a different payment method</small>
          </span>
          <span aria-hidden="true">›</span>
        </button>

        <div className="mt-pay-result__help">
          <span aria-hidden="true">🎧</span>
          <div>
            <strong>Need Help?</strong>
            <a href={`tel:${SUPPORT_PHONE}`}>{SUPPORT_PHONE}</a>
          </div>
        </div>

        {orderId ? <p className="mt-pay-result__ref">Order ref: {orderId}</p> : null}

        <button type="button" className="mt-payment-page__retry" onClick={() => navigate(detailPath())}>
          Retry Booking
        </button>
        <button type="button" className="mt-payment-page__retry mt-payment-page__retry--ghost" onClick={() => navigate('/journey')}>
          Back to Home
        </button>
      </div>
    </section>
  )
}
