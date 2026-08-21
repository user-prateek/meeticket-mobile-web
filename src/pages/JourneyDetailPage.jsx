import { useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAtomValue } from 'jotai'
import { Header } from '../components/Header'
import { CashIcon, ChevronIcon, ClockIcon, ModeIcon } from '../components/icons'
import { useJourneyOptionById, useSelectJourney } from '../hooks/useJourneyOptions'
import { tripAtom } from '../store/journey'
import { tripToSearch } from '../lib/tripQuery'
import './JourneyDetailPage.css'

function formatClock(value) {
  if (!value || typeof value !== 'string') return null
  const [h, m] = value.split(':')
  if (!h || !m) return null
  return `${h}:${m}`
}

function LegCard({ segment }) {
  const depart = formatClock(segment.departTime)
  const arrive = formatClock(segment.arrivalTime)
  const title = segment.detailTitle || segment.title

  return (
    <article className={`mt-leg is-${segment.mode}`}>
      <div className="mt-leg__head">
        <ModeIcon mode={segment.mode} size={32} className="mt-leg__badge" />
        <strong>{title}</strong>
        {segment.fareInr != null ? <span className="mt-leg__fare">₹{segment.fareInr}</span> : null}
      </div>

      <div className="mt-leg__body">
        <div className="mt-leg__duration">
          <ClockIcon size={16} />
          <span>{segment.durationMin} Min</span>
          {depart && arrive ? (
            <small className="mt-leg__clock">
              {depart}–{arrive}
            </small>
          ) : null}
        </div>

        {segment.from && segment.to ? (
          <div className="mt-leg__stops">
            <div className="mt-leg__rail" aria-hidden="true">
              <span className="mt-stop__dot" />
              <span className="mt-stop__line" />
              <span className="mt-stop__sq" />
            </div>
            <div className="mt-leg__copy">
              <div>
                <span>{segment.from}</span>
                <small>Boarding</small>
              </div>
              <div>
                <span>{segment.to}</span>
                <small>Alighting</small>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function InterchangeCard({ segment }) {
  return (
    <article className="mt-walk-card is-interchange">
      <ModeIcon mode="interchange" size={32} className="mt-leg__badge" />
      <div className="mt-walk-card__copy">
        <strong>{segment.detailTitle || segment.title}</strong>
        {segment.durationMin > 0 ? (
          <p>Change trains · about {segment.durationMin} Min</p>
        ) : (
          <p>Change trains</p>
        )}
      </div>
    </article>
  )
}

function JourneyDetailView({ journey, onBack, onConfirm, onSelectService }) {
  const [service, setService] = useState('')

  function chooseService(item) {
    setService(item.id)
    onSelectService?.(item)
  }

  return (
    <section className="mt-details-page">
      <Header title="Journey Detail" onBack={onBack} />
      <div className="mt-details-page__body">
        {journey ? (
          <>
            {journey.notSuggested && journey.note ? (
              <p className="mt-details-page__hint">{journey.note}</p>
            ) : null}

            {journey.segments.map((segment) =>
              segment.mode === 'interchange' ? (
                <InterchangeCard key={segment.id} segment={segment} />
              ) : (
                <LegCard key={segment.id} segment={segment} />
              ),
            )}

            {journey.services?.length > 0 ? (
              <div className="mt-services">
                {journey.services.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={service === item.id ? 'is-active' : ''}
                    onClick={() => chooseService(item)}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-details-page__note">This journey could not be found.</p>
        )}
      </div>
      {journey ? (
        <div className="mt-details-page__panel">
          <button type="button" className="mt-pay">
            <CashIcon size={28} />
            <span>{journey.payment.method}</span>
            <strong>₹{journey.payment.amountInr}</strong>
            <ChevronIcon size={18} className="mt-pay__chevron" />
          </button>
          <button type="button" className="mt-details-page__cta" onClick={onConfirm}>
            Confirm Multi Model
          </button>
        </div>
      ) : null}
    </section>
  )
}

/**
 * /journey-detail?id=1
 * Reads option from Jotai list by integer id.
 */
export function JourneyDetailPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const trip = useAtomValue(tripAtom)
  const selectJourney = useSelectJourney()
  const id = params.get('id')
  const journey = useJourneyOptionById(id)

  if (!journey) {
    const fallback = trip ? `/journey${tripToSearch(trip)}` : '/journey'
    return <Navigate to={fallback} replace />
  }

  function openCab(serviceId = 'pickup') {
    selectJourney(journey)
    navigate(`/cab?id=${journey.id}&service=${serviceId}`)
  }

  return (
    <JourneyDetailView
      journey={journey}
      onBack={() => navigate(trip ? `/journey${tripToSearch(trip)}` : '/journey')}
      onSelectService={(service) => openCab(service?.id ?? 'pickup')}
      onConfirm={() => openCab('pickup')}
    />
  )
}
