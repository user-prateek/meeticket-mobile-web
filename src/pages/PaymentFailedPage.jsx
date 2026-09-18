import { Navigate, useSearchParams } from 'react-router-dom'
import { useAtomValue } from 'jotai'
import { Header } from '../components/Header'
import {
  CardOutlineIcon,
  ChevronIcon,
  HeadsetOutlineIcon,
  HomeOutlineIcon,
} from '../components/icons'
import { helplineNumber } from '../api/config'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useJourneyOptionById } from '../hooks/useJourneyOptions'
import { cabDirectPath, isCabDirectRequest, rideHomePath } from '../lib/cabDirect'
import { GOTO_HOME_PATH, withAppContext } from '../lib/appContext'
import { tripToSearch } from '../lib/tripQuery'
import { lastMileSelectionAtom, tripAtom } from '../store/journey'
import './PaymentFailedPage.css'

/**
 * /payment/failed?id=1 — payment unsuccessful (pg_status failure).
 */
export function PaymentFailedPage() {
  const [params] = useSearchParams()
  const navigate = useAppNavigate()
  const trip = useAtomValue(tripAtom)
  const lastMile = useAtomValue(lastMileSelectionAtom)

  const journeyId = params.get('id')
  const journey = useJourneyOptionById(journeyId)
  const cabDirect = isCabDirectRequest(params, lastMile, journey)

  if (!journey) {
    const fallback = cabDirect
      ? rideHomePath(trip)
      : trip
        ? `/journey${tripToSearch(trip)}`
        : '/journey'
    return <Navigate to={withAppContext(fallback)} replace />
  }

  function detailPath() {
    if (cabDirect) {
      return cabDirectPath({
        trip,
        providerId: lastMile?.providerId,
        modeId: lastMile?.modeId,
        vehicleId: lastMile?.vehicleId,
      })
    }
    const next = new URLSearchParams({ id: String(journey.id) })
    if (lastMile?.providerId) next.set('provider', lastMile.providerId)
    if (lastMile?.modeId) next.set('mode', lastMile.modeId)
    if (lastMile?.vehicleId) next.set('vehicle', lastMile.vehicleId)
    return `/journey-detail?${next.toString()}`
  }

  function goHome() {
    navigate(GOTO_HOME_PATH, { replace: true })
  }

  const telHref = helplineNumber ? `tel:${helplineNumber.replace(/[^\d+]/g, '')}` : undefined

  return (
    <section className="mt-pay-fail">
      <Header title="Payment Failed" onBack={() => navigate(detailPath())} />

      <div className="mt-pay-fail__body">
        <div className="mt-pay-fail__alert">
          <span className="mt-pay-fail__bang" aria-hidden="true">
            !
          </span>
          <h2 className="mt-pay-fail__alert-title">Payment Unsuccessful</h2>
          <p className="mt-pay-fail__alert-copy">
            We&apos;re sorry! It seems there is some problem with your payment. But don&apos;t worry,
            you can retry the payment or choose another payment option to proceed further.
          </p>
        </div>

        <button type="button" className="mt-pay-fail__row" onClick={goHome}>
          <span className="mt-pay-fail__row-icon" aria-hidden="true">
            <HomeOutlineIcon size={20} />
          </span>
          <span className="mt-pay-fail__row-copy">
            <strong>Go to Homepage &amp; initiate a fresh booking</strong>
            <small>Start a new booking from the beginning</small>
          </span>
          <ChevronIcon size={16} className="mt-pay-fail__chevron" />
        </button>

        <button type="button" className="mt-pay-fail__row" onClick={() => navigate(detailPath())}>
          <span className="mt-pay-fail__row-icon" aria-hidden="true">
            <CardOutlineIcon size={20} />
          </span>
          <span className="mt-pay-fail__row-copy">
            <strong>Choose another payment option</strong>
            <small>Try a different payment method</small>
          </span>
          <ChevronIcon size={16} className="mt-pay-fail__chevron" />
        </button>

        <div className="mt-pay-fail__help">
          <span className="mt-pay-fail__row-icon" aria-hidden="true">
            <HeadsetOutlineIcon size={20} />
          </span>
          <div className="mt-pay-fail__help-copy">
            <strong>Need Help?</strong>
            {helplineNumber ? (
              <a href={telHref}>Please Call: {helplineNumber}</a>
            ) : (
              <span>Please Call:</span>
            )}
          </div>
        </div>

        <div className="mt-pay-fail__actions">
          <button type="button" className="mt-pay-fail__btn mt-pay-fail__btn--fill" onClick={() => navigate(detailPath())}>
            Retry Booking
          </button>
          <button type="button" className="mt-pay-fail__btn mt-pay-fail__btn--ghost" onClick={goHome}>
            Back to Home
          </button>
        </div>
      </div>
    </section>
  )
}
