import { Navigate, useSearchParams } from 'react-router-dom'
import { useAtomValue } from 'jotai'
import { Header } from '../components/Header'
import { helplineNumber } from '../api/config'
import { getOrderId, pgOrderRef } from '../api/orders'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useJourneyOptionById } from '../hooks/useJourneyOptions'
import { withAppContext } from '../lib/appContext'
import { tripToSearch } from '../lib/tripQuery'
import { lastMileSelectionAtom, orderAtom, tripAtom } from '../store/journey'
import './PaymentPage.css'

const REFUND_EMAIL = 'onlinerefund@tgsrtc.org'

/**
 * /payment/booking-failed?id=1 — payment done but no leg confirmed.
 */
export function PaymentBookingFailedPage() {
  const [params] = useSearchParams()
  const navigate = useAppNavigate()
  const trip = useAtomValue(tripAtom)
  const storedOrder = useAtomValue(orderAtom)
  const lastMile = useAtomValue(lastMileSelectionAtom)

  const journeyId = params.get('id')
  const journey = useJourneyOptionById(journeyId)
  const orderId = getOrderId(storedOrder)
  const obRef = pgOrderRef(storedOrder?.pgStatus) || orderId

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
      <Header title="Payment Done Booking Failed" onBack={() => navigate(detailPath())} />

      <div className="mt-pay-result">
        <div className="mt-pay-result__card mt-pay-result__card--fail">
          <span className="mt-pay-result__icon mt-pay-result__icon--calendar" aria-hidden="true">
            ✕
          </span>
          <h2>Booking Unsuccessful</h2>
          <p>Your payment was completed, but the booking could not be processed.</p>
        </div>

        {obRef ? (
          <div className="mt-pay-result__ref-card">
            <span aria-hidden="true">📄</span>
            <div>
              <small>OB Ref. No.</small>
              <strong>{obRef}</strong>
            </div>
            <button type="button" className="mt-pay-result__enquiry">
              Booking Enquiry
            </button>
          </div>
        ) : null}

        <div className="mt-pay-result__info">
          <span className="mt-pay-result__info-icon" aria-hidden="true">
            i
          </span>
          <p>
            Refunds for failed transactions are automatically credited within seven working days.
            For manual enquiry email <a href={`mailto:${REFUND_EMAIL}`}>{REFUND_EMAIL}</a> with your
            Name, Mobile, Email, OB Ref, Date/Time, and Amount.
          </p>
        </div>

        <div className="mt-pay-result__help">
          <span aria-hidden="true">🎧</span>
          <div>
            <strong>Need Help?</strong>
            {helplineNumber ? (
              <a href={`tel:${helplineNumber.replace(/[^\d+]/g, '')}`}>{helplineNumber}</a>
            ) : null}
          </div>
        </div>

        <button type="button" className="mt-payment-page__retry" onClick={() => navigate(detailPath())}>
          Retry Booking
        </button>
      </div>
    </section>
  )
}
