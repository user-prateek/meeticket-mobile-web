import { useState } from 'react'
import { Header } from '../components/Header'
import { CashIcon, ChevronIcon, ClockIcon, ModeIcon } from '../components/icons'
import type { RouteOption, RouteSegment } from '../types/route'
import './RouteDetailsPage.css'

export type RouteDetailsPageProps = {
  route?: RouteOption
  onBack: () => void
  onConfirm: () => void
}

function LegCard({ segment }: { segment: RouteSegment }) {
  return (
    <article className={`mt-leg is-${segment.mode}`}>
      <div className="mt-leg__head">
        <span className={`mt-leg__icon is-${segment.mode}`}>
          <ModeIcon mode={segment.mode} size={16} />
        </span>
        <strong>{segment.title}</strong>
        {segment.fareInr != null ? <span className="mt-leg__fare">₹{segment.fareInr}</span> : null}
      </div>

      <div className="mt-leg__body">
        <div className="mt-leg__duration">
          <ClockIcon size={16} />
          <span>{segment.durationMin} Min</span>
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

function WalkCard({ segment }: { segment: RouteSegment }) {
  const distance = segment.walkDistanceM != null ? ` (${segment.walkDistanceM} m)` : ''

  return (
    <article className="mt-walk-card">
      <span className="mt-leg__icon is-walk">
        <ModeIcon mode="walk" size={16} />
      </span>
      <div className="mt-walk-card__copy">
        <strong>
          Walk {segment.durationMin} Min{distance}
        </strong>
        {segment.from && segment.to ? (
          <p>
            from {segment.from} to {segment.to}
          </p>
        ) : null}
      </div>
    </article>
  )
}

export function RouteDetailsPage({ route, onBack, onConfirm }: RouteDetailsPageProps) {
  const [service, setService] = useState(route?.services[0]?.id ?? '')

  return (
    <section className="mt-details-page">
      <Header title="Journey Detail" onBack={onBack} />
      <div className="mt-details-page__body">
        {route ? (
          <>
            {route.segments.map((segment) =>
              segment.mode === 'walk' ? (
                <WalkCard key={segment.id} segment={segment} />
              ) : (
                <LegCard key={segment.id} segment={segment} />
              ),
            )}

            {route.services.length > 0 ? (
              <div className="mt-services">
                {route.services.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={service === item.id ? 'is-active' : ''}
                    onClick={() => setService(item.id)}
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
      {route ? (
        <div className="mt-details-page__panel">
          <button type="button" className="mt-pay">
            <CashIcon />
            <span>{route.payment.method}</span>
            <strong>₹{route.payment.amountInr}</strong>
            <ChevronIcon />
          </button>
          <button type="button" className="mt-srp__cta" onClick={onConfirm}>
            Confirm Multi Model
          </button>
        </div>
      ) : null}
    </section>
  )
}
