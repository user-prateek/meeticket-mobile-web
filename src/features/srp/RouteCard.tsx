import { useState, type MouseEvent } from 'react'
import type { LastMileOption, RouteOption, TransportMode } from '../../types/route'
import { AutoIcon, BikeIcon, CabIcon, ModeIcon } from '../../components/icons'
import './RouteCard.css'

type RouteCardProps = {
  route: RouteOption
  onSelect: (route: RouteOption) => void
}

const MODE_CLASS: Record<TransportMode, string> = {
  metro: 'is-metro',
  bus: 'is-bus',
  walk: 'is-walk',
  cab: 'is-cab',
  auto: 'is-auto',
  bike: 'is-bike',
}

function LastMileIcon({ mode }: { mode: LastMileOption['mode'] }) {
  if (mode === 'cab') return <CabIcon />
  if (mode === 'auto') return <AutoIcon />
  return <BikeIcon />
}

function CompactHeader({ route }: { route: RouteOption }) {
  const segment = route.segments[0]
  if (!segment) return null

  return (
    <div className="mt-compact">
      <div className={`mt-timeline__icon ${MODE_CLASS[segment.mode]}`}>
        <ModeIcon mode={segment.mode} size={18} />
      </div>
      <p className={`mt-compact__title ${MODE_CLASS[segment.mode]}`}>{segment.title}</p>
      <span className="mt-compact__dot" aria-hidden="true" />
      <span>{segment.durationMin} Min</span>
      {segment.fareInr != null ? (
        <>
          <span className="mt-compact__dot" aria-hidden="true" />
          <span>₹{segment.fareInr}</span>
        </>
      ) : null}
    </div>
  )
}

function Timeline({ route }: { route: RouteOption }) {
  return (
    <div className="mt-timeline">
      {route.segments.map((segment, index) => (
        <div key={segment.id} className="mt-timeline__item">
          {index > 0 ? <div className="mt-timeline__rail" aria-hidden="true" /> : null}
            <div className={`mt-timeline__step ${MODE_CLASS[segment.mode]}`}>
            <div className="mt-timeline__meta">
              <span>{segment.durationMin} Min</span>
              {segment.fareInr != null ? <span>₹{segment.fareInr}</span> : null}
            </div>
            <div className={`mt-timeline__icon ${MODE_CLASS[segment.mode]}`}>
              <ModeIcon mode={segment.mode} size={18} />
            </div>
            <p className={`mt-timeline__label ${MODE_CLASS[segment.mode]}`}>
              {segment.subtitle ?? segment.title}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

export function RouteCard({ route, onSelect }: RouteCardProps) {
  const [lastMile, setLastMile] = useState(route.lastMileOptions[0]?.id ?? '')
  const compact = route.segments.length === 1

  function stopCardClick(event: MouseEvent) {
    event.stopPropagation()
  }

  function selectLastMile(event: MouseEvent<HTMLButtonElement>, id: string) {
    event.stopPropagation()
    setLastMile(id)
  }

  function viewDetails(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation()
    onSelect(route)
  }

  return (
    <article className="mt-card" onClick={() => onSelect(route)}>
      {compact ? <CompactHeader route={route} /> : <Timeline route={route} />}

      {route.stops.length > 0 ? (
        <div className={`mt-stops${route.stops.length === 1 ? ' is-single' : ''}`}>
          {route.stops.map((stop) => (
            <div
              key={`${stop.from}-${stop.to}`}
              className={`mt-stop ${stop.mode ? MODE_CLASS[stop.mode] : ''}`}
            >
              <div className="mt-stop__rail" aria-hidden="true">
                <span className="mt-stop__dot" />
                <span className="mt-stop__line" />
                <span className="mt-stop__sq" />
              </div>
              <div className="mt-stop__copy">
                <span>{stop.from}</span>
                <span>{stop.to}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-lastmile" onClick={stopCardClick}>
        <div className="mt-lastmile__top">
          <p className="mt-lastmile__kicker">First & last mile options</p>
          <div className="mt-lastmile__brands">
            {route.lastMileProviders.map((provider) => (
              <span key={provider.id} className={`mt-brand mt-brand--${provider.id}`}>
                {provider.name}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-lastmile__row">
          <div className="mt-lastmile__modes">
            {route.lastMileOptions.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`mt-chip${lastMile === option.id ? ' is-selected' : ''}`}
                onClick={(event) => selectLastMile(event, option.id)}
              >
                <LastMileIcon mode={option.mode} />
                {option.label}
              </button>
            ))}
          </div>
          <button type="button" className="mt-details" onClick={viewDetails}>
            View Details
          </button>
        </div>
      </div>

      <div className="mt-metrics">
        <div>
          <span>Total Distance</span>
          <strong>{route.totalDistanceKm} km</strong>
        </div>
        <div>
          <span>Total Time</span>
          <strong>{route.totalTimeMin} Min</strong>
        </div>
        <div>
          <span>Total Fare</span>
          <strong className="is-fare">₹{route.totalFareInr}</strong>
        </div>
      </div>
    </article>
  )
}
