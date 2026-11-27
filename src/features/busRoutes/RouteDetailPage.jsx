import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import { parseTripQuery } from '../../lib/tripQuery'
import { fetchRouteDetail } from './api'
import { BusGlyph } from './BusGlyph'
import { estimateBusAlongStops } from './mapVehicleEta'
import { RouteLineMap } from './RouteLineMap'
import './RouteDetailPage.css'

const DETAIL_KEYS = [
  'route_id',
  'from_stop_id',
  'to_stop_id',
  'any_dest',
  'code',
  'fare',
  'category',
  'vehicle_id',
  'trip_id',
  'departure',
]

function flagFromParams(params, key, defaultValue = false) {
  if (!params.has(key)) return defaultValue
  const raw = String(params.get(key) || '').toLowerCase()
  if (raw === '0' || raw === 'false' || raw === 'no') return false
  if (raw === '1' || raw === 'true' || raw === 'yes') return true
  return defaultValue
}

function readDetailQuery(search) {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const trip = parseTripQuery(params)
  return {
    vehicleId: params.get('vehicle_id') || '',
    dropStopId: params.get('to_stop_id') || '',
    routeId: params.get('route_id') || '',
    anyDest: flagFromParams(params, 'any_dest', false),
    custLat: trip.fromLat,
    custLon: trip.fromLon,
  }
}

function splitClock(value) {
  const [time, period] = String(value || '').split(' ')
  return { time: time || value, period: period || '' }
}


function PinGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M8 1.6a4.2 4.2 0 0 0-4.2 4.2c0 3.2 4.2 8.2 4.2 8.2s4.2-5 4.2-8.2A4.2 4.2 0 0 0 8 1.6Z"
        fill="#2563eb"
      />
      <circle cx="8" cy="5.8" r="1.5" fill="#fff" />
    </svg>
  )
}

function PencilGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M9.2 3.2 12.8 6.8 5.6 14H2v-3.6L9.2 3.2Z"
        fill="none"
        stroke="#2563eb"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Design: Vehicle No fact mark. */
function VehicleNoIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect width="36" height="36" rx="18" fill="#E4F3FE" />
      <path
        d="M12 26.75C11.72 26.75 11.4833 26.6533 11.29 26.46C11.0967 26.2733 11 26.0367 11 25.75V23.7C10.7 23.3667 10.46 22.9967 10.28 22.59C10.0933 22.1833 10 21.7367 10 21.25V11.75C10 10.3633 10.6433 9.35 11.93 8.71C13.2167 8.07 15.24 7.75 18 7.75C20.8667 7.75 22.9167 8.05667 24.15 8.67C25.3833 9.28333 26 10.31 26 11.75V21.25C26 21.7367 25.91 22.1833 25.73 22.59C25.55 22.9967 25.3067 23.3667 25 23.7V25.75C25 26.0367 24.9033 26.2733 24.71 26.46C24.5167 26.6467 24.28 26.7433 24 26.75H23C22.7133 26.75 22.4767 26.6533 22.29 26.46C22.0967 26.2733 22 26.0367 22 25.75V24.75H14V25.75C14 26.0367 13.9033 26.2733 13.71 26.46C13.5167 26.6467 13.28 26.7433 13 26.75H12ZM18.05 10.75C19.8833 10.75 21.2133 10.75 22.04 10.75C22.8667 10.75 23.4033 10.75 23.65 10.75H12.45C12.75 10.75 13.3133 10.75 14.14 10.75C14.9667 10.75 16.27 10.75 18.05 10.75ZM22 17.75H14C13.4533 17.75 12.9833 17.75 12.59 17.75C12.1967 17.75 12 17.75 12 17.75H24C24 17.75 23.8033 17.75 23.41 17.75C23.0167 17.75 22.5467 17.75 22 17.75ZM12 15.75H24V12.75H12V15.75ZM15.56 21.31C15.8533 21.0233 16 20.67 16 20.25C16 19.83 15.8533 19.4767 15.56 19.19C15.2667 18.9033 14.9133 18.7567 14.5 18.75C14.0867 18.7433 13.7333 18.89 13.44 19.19C13.1467 19.49 13 19.8433 13 20.25C13 20.6567 13.1467 21.01 13.44 21.31C13.7333 21.61 14.0867 21.7567 14.5 21.75C14.9133 21.7433 15.2667 21.5967 15.56 21.31ZM22.56 21.31C22.8533 21.0233 23 20.67 23 20.25C23 19.83 22.8533 19.4767 22.56 19.19C22.2667 18.9033 21.9133 18.7567 21.5 18.75C21.0867 18.7433 20.7333 18.89 20.44 19.19C20.1467 19.49 20 19.8433 20 20.25C20 20.6567 20.1467 21.01 20.44 21.31C20.7333 21.61 21.0867 21.7567 21.5 21.75C21.9133 21.7433 22.2667 21.5967 22.56 21.31ZM12.45 10.75H23.65C23.3967 10.4633 22.86 10.2267 22.04 10.04C21.22 9.85333 19.89 9.75667 18.05 9.75C16.27 9.75 14.9667 9.85333 14.14 10.06C13.3133 10.2667 12.75 10.4967 12.45 10.75ZM14 22.75H22C22.5467 22.75 23.0167 22.5533 23.41 22.16C23.8033 21.7667 24 21.2967 24 20.75V17.75H12V20.75C12 21.2967 12.1967 21.7667 12.59 22.16C12.9833 22.5533 13.4533 22.75 14 22.75Z"
        fill="#407AFE"
      />
    </svg>
  )
}

/** Design: Bus Type fact mark. */
function BusTypeIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
      <rect width="36" height="36" rx="18" fill="#E4F3FE" />
      <path
        d="M14.375 11.25C13.8283 11.25 13.3583 11.0533 12.965 10.66C12.5717 10.2667 12.375 9.79667 12.375 9.25C12.375 8.69667 12.5717 8.22667 12.965 7.84C13.3583 7.45333 13.8283 7.25667 14.375 7.25C14.9283 7.25 15.3983 7.44667 15.785 7.84C16.1717 8.23333 16.3683 8.70333 16.375 9.25C16.375 9.79667 16.1783 10.2667 15.785 10.66C15.3917 11.0533 14.9217 11.25 14.375 11.25ZM19.875 25.25H13.425C12.8717 25.25 12.3683 25.0533 11.915 24.66C11.4617 24.2667 11.175 23.7967 11.055 23.25L8.875 12.25H10.925L13.125 23.25H19.875V25.25ZM25.375 27.25L22.475 22.25H15.525C15.045 22.25 14.625 22.1033 14.265 21.81C13.905 21.5167 13.675 21.13 13.575 20.65L12.475 15.3C12.295 14.5 12.4817 13.7933 13.035 13.18C13.5883 12.5667 14.2683 12.2567 15.075 12.25C15.6617 12.25 16.1917 12.4233 16.665 12.77C17.1383 13.1167 17.4417 13.5933 17.575 14.2L18.675 19.25H21.925C22.2717 19.25 22.5983 19.34 22.905 19.52C23.2117 19.7 23.4517 19.9433 23.625 20.25L27.125 26.25L25.375 27.25Z"
        fill="#407AFE"
      />
    </svg>
  )
}

function ListGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M3 4.2h10M3 8h10M3 11.8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

function MapGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M2.2 3.4 6 2.2l4 1.6 3.8-1.2V12.6L10 13.8 6 12.2 2.2 13.4V3.4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  )
}

const DETAIL_POLL_MS = 10_000
const BUS_TICK_MS = 1_000

function LiveBusDetailPage() {
  const location = useLocation()
  const navigate = useAppNavigate()
  const query = useMemo(() => readDetailQuery(location.search), [location.search])
  const [view, setView] = useState('map')
  const [detail, setDetail] = useState(null)
  const [busLive, setBusLive] = useState(null)
  const [departureId, setDepartureId] = useState('')
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!query.vehicleId) {
      setStatus('error')
      setError('Vehicle is missing')
      return undefined
    }
    if (query.custLat == null || query.custLon == null) {
      setStatus('error')
      setError('from_lat and from_lon are required')
      return undefined
    }
    if (!query.dropStopId) {
      setStatus('error')
      setError('Drop stop is missing')
      return undefined
    }

    let cancelled = false
    let controller = null
    let timer = null
    let hasLoaded = false

    async function load() {
      controller?.abort()
      controller = new AbortController()
      if (!hasLoaded) {
        setStatus('loading')
        setError('')
      }
      try {
        const next = await fetchRouteDetail(
          {
            vehicleId: query.vehicleId,
            custLat: query.custLat,
            custLon: query.custLon,
            dropStopId: query.dropStopId,
            anyDest: query.anyDest,
          },
          { signal: controller.signal },
        )
        if (cancelled) return
        setDetail(next)
        setDepartureId((prev) => prev || next.departures[0]?.id || '')
        setStatus('ready')
        setError('')
        hasLoaded = true
      } catch (err) {
        if (err?.name === 'AbortError' || cancelled) return
        if (!hasLoaded) {
          setError(err?.message || 'Could not load this route')
          setStatus('error')
        }
      }
    }

    function scheduleNext() {
      timer = window.setTimeout(async () => {
        if (!cancelled && document.visibilityState === 'visible') await load()
        if (!cancelled) scheduleNext()
      }, DETAIL_POLL_MS)
    }

    load().then(() => {
      if (!cancelled) scheduleNext()
    })

    return () => {
      cancelled = true
      controller?.abort()
      window.clearTimeout(timer)
    }
  }, [query.vehicleId, query.custLat, query.custLon, query.dropStopId, query.anyDest])

  // Between ETA polls, creep the bus along the current leg using stop clocks + now.
  useEffect(() => {
    if (!detail?.stops?.length) {
      setBusLive(null)
      return undefined
    }
    if (detail.bus?.source === 'live') {
      setBusLive(detail.bus)
      return undefined
    }
    function tick() {
      const next = estimateBusAlongStops(detail.stops)
      setBusLive(next ? { ...next, source: 'estimate' } : null)
    }
    tick()
    const id = window.setInterval(tick, BUS_TICK_MS)
    return () => window.clearInterval(id)
  }, [detail])

  // Waypoints sorted by stop_sequence in mapVehicleEta — OSRM follows that order.
  const line = useMemo(() => {
    if (!detail?.stops?.length) return []
    return detail.stops.map((stop) => ({ lat: stop.lat, lng: stop.lng }))
  }, [detail])

  const mapStops = useMemo(
    () => (detail ? detail.stops.map((stop) => ({ id: stop.id, name: stop.name, lat: stop.lat, lng: stop.lng })) : []),
    [detail],
  )

  const mapRouteStart = detail?.routeStart || detail?.stops?.[0] || null
  const mapRouteEnd =
    detail?.routeEnd || (detail?.stops?.length ? detail.stops[detail.stops.length - 1] : null)
  const mapBus = busLive || detail?.bus || null

  function buyTicket() {
    const params = new URLSearchParams(location.search.startsWith('?') ? location.search.slice(1) : location.search)
    if (departureId) params.set('departure', departureId)
    navigate(`/livebus/summary?${params}`)
  }

  function goBack() {
    const params = new URLSearchParams(location.search.startsWith('?') ? location.search.slice(1) : location.search)
    DETAIL_KEYS.forEach((key) => params.delete(key))
    navigate(`/livebus?${params}`)
  }

  const pickupAt = detail?.stops.findIndex((stop) => stop.role === 'pickup') ?? -1

  return (
    <section className={`rd-page${view === 'stops' ? ' is-stops' : ''}`}>
      <div className="rd-top">
        <button type="button" className="rd-back" onClick={goBack} aria-label="Go back">
          ‹
        </button>
        <div className="rd-switch" role="tablist" aria-label="Route view">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'stops'}
            className={view === 'stops' ? 'is-active' : ''}
            onClick={() => setView('stops')}
          >
            <ListGlyph /> Stops View
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'map'}
            className={view === 'map' ? 'is-active' : ''}
            onClick={() => setView('map')}
          >
            <MapGlyph /> Map View
          </button>
        </div>
      </div>

      {view === 'map' && detail ? (
        <RouteLineMap
          points={line}
          stops={mapStops}
          routeStart={mapRouteStart}
          routeEnd={mapRouteEnd}
          bus={mapBus}
          busLabel={detail.busLabel}
        />
      ) : null}

      <div className={`rd-sheet${view === 'stops' ? ' is-stops' : ''}`}>
        {detail ? (
          <div className="rd-route">
            <span className="rd-badge">
              <BusGlyph size={15} />
              {detail.code}
            </span>
            <div className="rd-route__copy">
              <span className="rd-class">{detail.category}</span>
              <p>
                {detail.fromPlace} → {detail.toPlace}
              </p>
            </div>
            {view === 'map' ? <strong className="rd-fare">₹{detail.fareInr}</strong> : null}
            {view === 'stops' ? (
              <button type="button" className="rd-close" onClick={() => setView('map')} aria-label="Close stops">
                ×
              </button>
            ) : null}
          </div>
        ) : null}

        {status === 'loading' ? <p className="rd-status">Loading route…</p> : null}
        {status === 'error' ? <p className="rd-status">{error}</p> : null}

        {view === 'stops' && detail ? (
          <>
            <p className="rd-note">
              <PinGlyph />
              Live journey stops & estimated arrival times
            </p>
            <ol className="rd-timeline">
              {detail.stops.map((stop, index) => {
                const isStart = index === 0
                const isPickup = stop.role === 'pickup'
                const isDrop = stop.role === 'drop'
                const isPassed =
                  Boolean(stop.crossed) || (pickupAt >= 0 && index < pickupAt && !isPickup)
                // Line stays blue through boarding, grey for the rest of the trip.
                const isTraveled = pickupAt >= 0 ? index < pickupAt : isPassed
                const className = [
                  isStart ? 'is-start' : '',
                  isPassed ? 'is-passed' : '',
                  isPickup ? 'is-pickup' : '',
                  isDrop ? 'is-drop' : '',
                  isTraveled || isPickup ? 'is-traveled' : '',
                ]
                  .filter(Boolean)
                  .join(' ')
                return (
                  <li key={stop.id} className={className}>
                    {isStart ? (
                      <span className="rd-timeline__bus" aria-hidden="true">
                        <BusGlyph size={11} />
                      </span>
                    ) : null}
                    <div className="rd-timeline__body">
                      <span className="rd-timeline__name">{stop.name}</span>
                      <span className="rd-timeline__time">{stop.time}</span>
                      {isPickup ? (
                        <span className="rd-timeline__hint">Pickup stop near you</span>
                      ) : null}
                      {isDrop ? <span className="rd-timeline__hint">Drop Stop</span> : null}
                    </div>
                  </li>
                )
              })}
            </ol>
          </>
        ) : null}

        {view === 'map' && detail ? (
          <>
            <div className="rd-facts">
              <p>
                <span className="rd-facts__icon" aria-hidden="true">
                  <VehicleNoIcon />
                </span>
                <span>Vehicle No</span>
                <strong>{detail.vehicleNo}</strong>
              </p>
              <p>
                <span className="rd-facts__icon" aria-hidden="true">
                  <BusTypeIcon />
                </span>
                <span>Bus Type</span>
                <strong>{detail.busType}</strong>
              </p>
            </div>
            <button type="button" className="rd-board" onClick={() => setView('stops')}>
              <PinGlyph />
              <span>
                <span>Nearest Boarding</span>
                <strong>{detail.boardingName}</strong>
              </span>
              <PencilGlyph />
            </button>
            <div className="rd-departures">
              <p>Departure time</p>
              <div>
                {detail.departures.map((trip) => {
                  const clock = splitClock(trip.time)
                  return (
                    <button
                      key={trip.id}
                      type="button"
                      className={trip.id === departureId ? 'is-active' : ''}
                      onClick={() => setDepartureId(trip.id)}
                    >
                      {clock.time}
                      <small>{clock.period}</small>
                    </button>
                  )
                })}
              </div>
            </div>
            <button type="button" className="rd-buy" onClick={buyTicket}>
              Buy Bus Ticket
            </button>
          </>
        ) : null}
      </div>
    </section>
  )
}

export function RouteDetailPage() {
  return <LiveBusDetailPage />
}
