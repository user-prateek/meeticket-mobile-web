import { useState } from 'react'
import { ModeIcon } from '../../components/icons'
import { metroLineFromRouteId } from '../../constants/metroLines'
import olaLogo from '../../assets/brands/ola.png'
import rapidoLogo from '../../assets/brands/rapido.png'
import refexLogo from '../../assets/brands/refex.png'
import './RouteCard.css'

const MODE_CLASS = {
  metro: 'is-metro',
  bus: 'is-bus',
  walk: 'is-walk',
  interchange: 'is-interchange',
  cab: 'is-cab',
  auto: 'is-auto',
  bike: 'is-bike',
}

const BRAND_LOGO = {
  ola: olaLogo,
  rapido: rapidoLogo,
  refex: refexLogo,
}

function BrandLogo({ id, name }) {
  const src = BRAND_LOGO[id]
  if (!src) return <span className={`mt-brand mt-brand--${id}`}>{name}</span>
  return <img className={`mt-brand mt-brand--${id}`} src={src} alt={name} draggable={false} />
}

function CompactHeader({ segment }) {
  if (!segment) return null

  return (
    <div className="mt-compact">
      <div className={`mt-timeline__icon ${MODE_CLASS[segment.mode]}`}>
        <ModeIcon mode={segment.mode} size={36} />
      </div>
      <div className="mt-compact__copy">
        <p className={`mt-compact__title ${MODE_CLASS[segment.mode]}`}>
          {segment.title}
          <span className="mt-compact__sep" aria-hidden="true">
            •
          </span>
          <span className="mt-compact__time">{segment.durationMin} Min</span>
        </p>
        {segment.fareInr != null ? <span className="mt-compact__fare">₹{segment.fareInr}</span> : null}
      </div>
    </div>
  )
}

function Timeline({ segments }) {
  const isInterchange = segments.find((segment) => segment.mode === 'interchange')
  return (
    <div className="mt-timeline">
      {segments.map((segment, index) => (
        <div key={segment.id} className="mt-timeline__item">
          {index > 0 ? <div className="mt-timeline__rail" aria-hidden="true" /> : null}
          <div className={`mt-timeline__step ${MODE_CLASS[segment.mode] || ''}`}>
            <div className={`mt-timeline__icon ${MODE_CLASS[segment.mode] || ''}`}>
              <ModeIcon mode={segment.mode} size={36} />
            </div>
            <div className="mt-timeline__meta">
              {segment.mode === 'interchange' ? (
                <span>{segment.durationMin > 0 ? `${segment.durationMin} Min` : 'Change'}</span>
              ) : (
                <>
                  <span>{segment.durationMin} Min</span>
                  {segment.fareInr != null && !isInterchange ? <span>₹{segment.fareInr}</span> : null}
                </>
              )}
            </div>
            <p className="mt-timeline__label">{segment.subtitle ?? segment.title}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

/** Card for one journey option (metro/bus hops only; access/egress are last-mile). */
export function RouteCard({ option, selected = false, onSelect, onOpenDetails }) {
  const [lastMile, setLastMile] = useState('')
  const timeline = option.cardSegments?.length ? option.cardSegments : option.segments
  const transitOnly = timeline.filter((seg) => seg.mode !== 'interchange')
  const compact = transitOnly.length === 1 && timeline.length === 1

  function stopCardClick(event) {
    event.stopPropagation()
  }

  function selectLastMile(event, id) {
    event.stopPropagation()
    //setLastMile(id)
  }

  function viewDetails(event) {
    event.stopPropagation()
    onOpenDetails?.(option)
  }

  return (
    <article
      className={`mt-card${selected ? ' is-selected' : ''}${option.notSuggested ? ' is-not-suggested' : ''}`}
      onClick={() => onSelect?.(option)}
      aria-pressed={selected}
    >
      {option.notSuggested ? (
        <p className="mt-card__hint">Not suggested — short enough to walk instead of metro.</p>
      ) : null}

      {compact ? (
        <CompactHeader segment={timeline[0]} />
      ) : (
        <Timeline segments={timeline} />
      )}

      {option.stops?.length > 0 ? (
        <div className={`mt-stops${option.stops.length === 1 ? ' is-single' : ''}`}>
          {option.stops.map((stop) => {
            const line =
              stop.mode === 'metro' ? metroLineFromRouteId(stop.routeId) : null
            const lineStyle = line ? { background: line.hex } : undefined
            const railStyle = line
              ? { background: `color-mix(in srgb, ${line.hex} 35%, #d5dae2)` }
              : undefined

            return (
              <div
                key={`${stop.from}-${stop.to}-${stop.routeId || ''}`}
                className={`mt-stop ${stop.mode ? MODE_CLASS[stop.mode] : ''}`.trim()}
              >
                <div className="mt-stop__rail" aria-hidden="true">
                  <span className="mt-stop__dot" style={lineStyle} />
                  <span className="mt-stop__line" style={railStyle} />
                  <span className="mt-stop__sq" style={lineStyle} />
                </div>
                <div className="mt-stop__copy">
                  <span>{stop.from}</span>
                  <span>{stop.to}</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      <div className="mt-lastmile" onClick={stopCardClick}>
        <div className="mt-lastmile__top">
          <p className="mt-lastmile__kicker">First & last mile options</p>
          <div className="mt-lastmile__brands">
            {(option.lastMileProviders ?? []).map((provider) => (
              <BrandLogo key={provider.id} id={provider.id} name={provider.name} />
            ))}
          </div>
        </div>

        <div className="mt-lastmile__row">
          <div className="mt-lastmile__modes">
            {(option.lastMileOptions ?? []).map((mileOption) => (
              <button
                key={mileOption.id}
                type="button"
                className={`mt-chip${lastMile === mileOption.id ? ' is-selected' : ''}`}
                onClick={(event) => selectLastMile(event, mileOption.id)}
              >
                <ModeIcon mode={mileOption.mode} size={16} className="mt-chip__icon" />
                {mileOption.label}
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
          <strong>{option.totalDistanceKm}</strong>
        </div>
        <div>
          <span>Total Time</span>
          <strong>{option.totalTimeMin} Min</strong>
        </div>
        <div>
          <span>Total Fare</span>
          <strong className="is-fare">₹{option.totalFareInr}</strong>
        </div>
      </div>
    </article>
  )
}
