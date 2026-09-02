import { formatMetroStationName } from '../../api/journey'
import { BusGlyph, MetroGlyph, ModeIcon, PinIcon, ViewDetailsIcon } from '../../components/icons'
import { LAST_MILE_MODES } from '../../constants/lastMile'
import { resolveCabProviderId } from '../../constants/tickets'
import olaLogo from '../../assets/brands/ola.png'
import rapidoLogo from '../../assets/brands/rapido.png'
import refexLogo from '../../assets/brands/refex.png'
import '../../styles/fare-classes.css'
import '../srp/RouteCard.css'
import './BookingCard.css'

const MODE_CLASS = {
  metro: 'is-metro',
  bus: 'is-bus',
  walk: 'is-walk',
  cab: 'is-cab',
}

const BRAND_LOGO = {
  ola: olaLogo,
  rapido: rapidoLogo,
  refex: refexLogo,
}

function shortPlaceName(value) {
  const text = String(value || '').trim()
  if (!text) return ''
  return text.split(',')[0].trim()
}

function displayStationName(name, mode) {
  if (mode !== 'metro') return name
  return formatMetroStationName(name)
}

function BrandLogo({ id, name }) {
  const src = BRAND_LOGO[id]
  if (!src) return <span className="mt-brand mt-brand--text">{name}</span>
  return <img className={`mt-brand mt-brand--${id}`} src={src} alt={name} draggable={false} />
}

function CapsuleGlyph({ mode, className }) {
  if (mode === 'bus') return <BusGlyph size={13} className={className} />
  return <MetroGlyph size={13} className={className} />
}

function AccessCurve() {
  return (
    <svg
      className="mt-mile__curve"
      width="40"
      height="34"
      viewBox="0 0 40 34"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M10 32C10 18 12 5 32 2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeDasharray="2.2 2.8"
      />
      <path
        d="M28 1 L32.5 2.2 L29.2 5.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}

function VehicleCheckBadge() {
  return (
    <span className="mt-provider-options__check" aria-hidden="true">
      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
        <path
          d="M2 5.2 4.1 7.2 8 2.8"
          stroke="#fff"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function getTransitEdge(segments, segmentId) {
  const transit = segments.filter(
    (segment) => segment.mode === 'metro' || segment.mode === 'bus' || segment.mode === 'cab',
  )
  if (!transit.length) return 'start'
  if (transit.length === 1) return 'start'
  const index = transit.findIndex((segment) => segment.id === segmentId)
  if (index <= 0) return 'start'
  if (index >= transit.length - 1) return 'end'
  return 'center'
}

function ModeCapsule({ segment, edge = 'start' }) {
  if (segment.mode === 'walk') {
    return (
      <div className="mt-walk-badge">
        <ModeIcon mode="walk" size={18} className="mt-walk-badge__icon" />
      </div>
    )
  }

  const icon = <CapsuleGlyph mode={segment.mode === 'cab' ? 'metro' : segment.mode} className="mt-capsule__icon" />
  const iconFirst = edge !== 'end'
  const modeClass = segment.mode === 'cab' ? 'metro' : segment.mode

  return (
    <div className={`mt-capsule is-${modeClass}`}>
      {iconFirst ? icon : null}
      <span className="mt-capsule__label">{segment.title}</span>
      {!iconFirst ? icon : null}
    </div>
  )
}

function TransitMeta({ segment, edge }) {
  const fareSuffix = segment.fareInr ? `, ₹${segment.fareInr}` : ''
  const edgeClass = edge === 'end' ? 'is-edge-end' : 'is-edge-start'
  const modeClass = segment.mode === 'bus' ? 'bus' : 'metro'

  return (
    <p className={`mt-capsule__meta is-${modeClass} ${edgeClass}`}>
      <span className="mt-capsule__meta-text">
        {segment.durationMin} Min{fareSuffix}
      </span>
    </p>
  )
}

function CompactHeader({ segment }) {
  if (!segment) return null

  return (
    <div className="mt-compact">
      <ModeCapsule segment={segment} edge="start" />
      <p className={`mt-capsule__meta is-${segment.mode === 'bus' ? 'bus' : 'metro'} is-edge-start`}>
        <span className="mt-capsule__meta-text">
          {segment.durationMin} Min{segment.fareInr ? `, ₹${segment.fareInr}` : ''}
        </span>
      </p>
    </div>
  )
}

function BookingTimeline({ segments }) {
  const transitOnly = segments.filter((segment) => segment.mode !== 'walk')
  const compact = transitOnly.length === 1 && segments.length === 1

  if (compact) {
    return <CompactHeader segment={segments[0]} />
  }

  return (
    <div className="mt-transit-fare">
      <div className="mt-timeline">
        {segments.map((segment, index) => {
          const isWalk = segment.mode === 'walk'
          const edge = isWalk ? 'center' : getTransitEdge(segments, segment.id)
          const itemLayout = isWalk ? 'center' : edge === 'end' ? 'end' : 'start'

          return (
            <div key={segment.id} className={`mt-timeline__item is-layout-${itemLayout}`}>
              {index > 0 ? <div className="mt-timeline__rail" aria-hidden="true" /> : null}
              <div className={`mt-timeline__step ${MODE_CLASS[segment.mode] || ''} is-align-${edge}`}>
                {isWalk ? (
                  <>
                    <ModeCapsule segment={segment} edge={edge} />
                    <p className="mt-walk__meta">{segment.durationMin} Min</p>
                  </>
                ) : (
                  <>
                    <ModeCapsule segment={segment} edge={edge} />
                    <TransitMeta segment={segment} edge={edge} />
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function busFareStripSide(segments) {
  const busSegment = segments.find((segment) => segment.mode === 'bus')
  if (!busSegment) return 'start'
  return getTransitEdge(segments, busSegment.id) === 'end' ? 'end' : 'start'
}

function BusRouteStrip({ stops, segments }) {
  const busStop = stops?.find((stop) => stop.mode === 'bus' && stop.routeName)
  if (!busStop) return null

  const side = busFareStripSide(segments)

  return (
    <div
      className={`mt-fare-classes is-bus is-side-${side} mt-booking-card__fare-strip`}
      aria-label="Booked bus route"
    >
      <div className="mt-fare-classes__row is-selected">
        <span className="mt-fare-classes__label">{busStop.routeName}</span>
        {busStop.fareInr ? <span className="mt-fare-classes__fare">₹{busStop.fareInr}</span> : null}
      </div>
    </div>
  )
}

function BookingStops({ stops }) {
  if (!stops?.length) return null

  return (
    <div className={`mt-stops${stops.length === 1 ? ' is-single' : ''}`}>
      {stops.map((stop, index) => (
        <div key={`${stop.from}-${stop.to}-${index}`} className={`mt-stop ${MODE_CLASS[stop.mode] || ''}`.trim()}>
          <div className="mt-stop__rail" aria-hidden="true">
            <span className="mt-stop__dot" />
            <span className="mt-stop__line" />
            <span className="mt-stop__sq" />
          </div>
          <div className="mt-stop__copy">
            <span>{displayStationName(stop.from, stop.mode)}</span>
            <span>{displayStationName(stop.to, stop.mode)}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

function FirstMileSection({ booking }) {
  const { cabLeg, cabFrom, cabFareInr, cabDurationMin, lastMileMode, cabVehicleLabel } = booking
  if (!cabLeg || !cabFrom) return null

  const providerId = resolveCabProviderId(cabLeg, cabLeg.booking_details)
  const pickupLabel = booking.pickupLabel || shortPlaceName(cabFrom)
  const mode = lastMileMode || 'cab'

  return (
    <div className="mt-mile">
      <div className="mt-mile__row">
        <div className="mt-mile__origin">
          <AccessCurve />
          <PinIcon size={14} className="mt-mile__pin" />
          <div className="mt-mile__places">
            <span className="mt-mile__station">{pickupLabel}</span>
          </div>
        </div>

        <div className="mt-mile__modes" role="group" aria-label="First mile mode">
          {LAST_MILE_MODES.map((mileOption) => (
            <span
              key={mileOption.id}
              className={`mt-mile__mode mt-booking-card__mode${mode === mileOption.id ? ' is-selected' : ''}`}
            >
              <ModeIcon mode={mileOption.id} size={18} className="mt-mile__mode-icon" />
              {mileOption.label}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-provider-options mt-booking-card__provider">
        <div className="mt-provider-options__cell is-selected">
          <VehicleCheckBadge />
          <div className="mt-provider-options__row">
            <BrandLogo id={providerId} name={cabLeg.cab_aggregator || providerId} />
            <ModeIcon mode={mode} size={16} className="mt-provider-options__mode-icon" />
          </div>
          <span className="mt-provider-options__label">{cabVehicleLabel || 'Cab'}</span>
          <span className="mt-provider-options__meta">
            {cabDurationMin ? <span className="mt-provider-options__eta">{cabDurationMin} Min</span> : null}
            {cabDurationMin && cabFareInr ? (
              <span className="mt-provider-options__dot" aria-hidden="true">
                {' '}
                •{' '}
              </span>
            ) : null}
            {cabFareInr ? <span className="mt-provider-options__fare">₹{cabFareInr}</span> : null}
          </span>
        </div>
      </div>
    </div>
  )
}

export function BookingCard({ booking, onViewDetails }) {
  const distanceLabel = booking.totalDistanceKm != null ? `${booking.totalDistanceKm} km` : '—'
  const timeLabel = booking.totalTimeMin != null ? `${booking.totalTimeMin} Min` : '—'

  return (
    <article className="mt-card mt-booking-card">
      {booking.segments?.length ? <BookingTimeline segments={booking.segments} /> : null}

      <BusRouteStrip stops={booking.stops} segments={booking.segments} />
      <BookingStops stops={booking.stops} />

      <FirstMileSection booking={booking} />

      <div className="mt-metrics">
        <div>
          <span>Total Distance</span>
          <strong>{distanceLabel}</strong>
        </div>
        <div>
          <span>Total Time</span>
          <strong>{timeLabel}</strong>
        </div>
        <div>
          <span>Total Fare</span>
          <strong className="is-fare">₹{booking.totalFareInr}</strong>
        </div>
      </div>

      <button type="button" className="mt-booking-card__view" onClick={onViewDetails}>
        <ViewDetailsIcon />
        View Details
      </button>
    </article>
  )
}
