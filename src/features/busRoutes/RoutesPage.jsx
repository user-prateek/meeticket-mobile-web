import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Header } from '../../components/Header'
import { ChevronIcon } from '../../components/icons'
import { useAppNavigate } from '../../hooks/useAppNavigate'
import { GOTO_HOME_PATH } from '../../lib/appContext'
import { hasRequiredTripParams, parseTripQuery } from '../../lib/tripQuery'
import { fetchBusRouteOptions } from './api'
import { LiveBusMap } from './LiveBusMap'
import { BUS_ROUTE_FILTERS, cardForFilter } from './mapBusRoutes'
import './RoutesPage.css'

function ListIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path d="M3 4.5h12M3 9h12M3 13.5h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function MapIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        d="M6.2 3.2 2.5 4.6v10.2l3.7-1.4 4.6 1.4 3.7-1.4V3.2l-3.7 1.4-4.6-1.4Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M6.2 3.2v10.2M10.8 4.6v10.2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

function RouteCard({ card, onView }) {
  return (
    <article className="br-card">
      <div className="br-card__top">
        <span className="br-badge">{card.code}</span>
        <div className="br-stops">
          <div className="br-stop">
            <span className="br-mark is-from" aria-hidden="true" />
            <span className="br-stop__name">{card.from}</span>
            {card.departLabel ? <span className="br-stop__aside is-time">{card.departLabel}</span> : null}
          </div>
          <div className="br-stop">
            <span className="br-mark is-to" aria-hidden="true" />
            <span className="br-stop__name">{card.to}</span>
            {card.fareInr != null ? <span className="br-stop__aside is-fare">₹{card.fareInr}</span> : null}
          </div>
        </div>
      </div>
      {card.corridor ? <p className="br-corridor">{card.corridor}</p> : null}
      <div className="br-card__foot">
        <div className="br-pills">
          {card.category ? <span className="br-pill">{card.category}</span> : null}
          {card.distanceLabel ? <span className="br-pill">{card.distanceLabel}</span> : null}
          {card.vehicleId ? <span className="br-pill">{card.vehicleId}</span> : null}
          {card.scheduled ? <span className="br-pill is-scheduled">Scheduled</span> : null}
        </div>
        <button type="button" className="br-view" onClick={() => onView?.(card)}>
          View Route <ChevronIcon size={14} />
        </button>
      </div>
    </article>
  )
}

const NEARBY_POLL_MS = 10_000

/**
 * /livebus?from_lat&from_lon&to_lat&to_lon&from&to
 * Same query as /journey. This screen lists direct TGSRTC routes only.
 * Nearby buses are polled every 10s while this screen is mounted.
 */
export function RoutesPage() {
  const location = useLocation()
  const navigate = useAppNavigate()
  const paramsOk = hasRequiredTripParams(location.search)
  const trip = useMemo(
    () => (paramsOk ? parseTripQuery(location.search) : null),
    [paramsOk, location.search],
  )
  const [view, setView] = useState('list')
  const [filterId, setFilterId] = useState('all')
  const [routes, setRoutes] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!trip) {
      setRoutes([])
      setError('from_lat, from_lon, to_lat and to_lon are required')
      setStatus('error')
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
        const next = await fetchBusRouteOptions(trip, { signal: controller.signal })
        if (cancelled) return
        setRoutes(next)
        setStatus('ready')
        setError('')
        hasLoaded = true
      } catch (err) {
        if (err?.name === 'AbortError' || cancelled) return
        if (!hasLoaded) {
          setRoutes([])
          setError(err?.message || 'Could not load bus routes')
          setStatus('error')
        }
      }
    }

    function scheduleNext() {
      timer = window.setTimeout(async () => {
        if (!cancelled && document.visibilityState === 'visible') await load()
        if (!cancelled) scheduleNext()
      }, NEARBY_POLL_MS)
    }

    load().then(() => {
      if (!cancelled) scheduleNext()
    })

    return () => {
      cancelled = true
      controller?.abort()
      window.clearTimeout(timer)
    }
  }, [trip, reloadKey])

  const visible = useMemo(
    () => routes.map((card) => cardForFilter(card, filterId)).filter(Boolean),
    [filterId, routes],
  )
  const buses = useMemo(
    () => routes.filter((bus) => bus.lat != null && bus.lng != null),
    [routes],
  )
  const destination = useMemo(() => {
    const bus = routes.find((item) => item.destLat != null && item.destLng != null)
    if (!bus) return null
    return { lat: bus.destLat, lng: bus.destLng, name: bus.to }
  }, [routes])
  const mapCenter = useMemo(() => {
    if (trip?.fromLat == null || trip?.fromLon == null) return null
    return { lat: trip.fromLat, lng: trip.fromLon }
  }, [trip])

  function goHome() {
    navigate(GOTO_HOME_PATH, { replace: true })
  }

  const openRoute = useCallback(
    (card) => {
      if (!card?.routeId && !card?.vehicleId) return
      const params = new URLSearchParams(
        location.search.startsWith('?') ? location.search.slice(1) : location.search,
      )
      params.set('route_id', card.routeId)
      if (card.originStopId) params.set('from_stop_id', card.originStopId)
      if (card.destinationStopId) params.set('to_stop_id', card.destinationStopId)
      if (card.code) params.set('code', card.code)
      if (card.vehicleId) params.set('vehicle_id', card.vehicleId)
      if (card.tripId) params.set('trip_id', card.tripId)
      if (card.fareInr != null) params.set('fare', String(card.fareInr))
      if (card.category) params.set('category', card.category)
      navigate(`/livebus/route?${params}`)
    },
    [location.search, navigate],
  )

  const subtitle = trip?.fromPlace && trip?.toPlace ? `${trip.fromPlace} → ${trip.toPlace}` : null

  return (
    <section className="br-page">
      <Header title="Journey Options" subtitle={subtitle} onBack={goHome} />
      <div className="br-tabs" role="tablist" aria-label="Results view">
        <button
          type="button"
          role="tab"
          aria-selected={view === 'list'}
          className={view === 'list' ? 'is-active' : ''}
          onClick={() => setView('list')}
        >
          <ListIcon /> List View
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={view === 'map'}
          className={view === 'map' ? 'is-active' : ''}
          onClick={() => setView('map')}
        >
          <MapIcon /> Map View
        </button>
      </div>
      {view === 'list' ? (
        <div className="br-filters" role="tablist" aria-label="Service class">
          {BUS_ROUTE_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              role="tab"
              aria-selected={filterId === filter.id}
              className={`br-filter${filterId === filter.id ? ' is-active' : ''}`}
              onClick={() => setFilterId(filter.id)}
            >
              {filter.label}
            </button>
          ))}
        </div>
      ) : null}
      {view === 'map' ? (
        <LiveBusMap
          center={mapCenter || (buses[0] ? { lat: buses[0].lat, lng: buses[0].lng } : { lat: 17.4, lng: 78.48 })}
          destination={destination}
          buses={buses}
          onSelect={openRoute}
        />
      ) : null}
      <div className={`br-list${view === 'map' ? ' is-hidden' : ''}`}>
        {status === 'loading' ? <p className="br-status">Loading routes…</p> : null}
        {status === 'error' ? (
          <div className="br-status">
            <p>{error}</p>
            <button type="button" className="br-retry" onClick={() => setReloadKey((key) => key + 1)}>
              Retry
            </button>
          </div>
        ) : null}
        {status === 'ready' && view === 'list' && visible.length === 0 ? (
          <p className="br-status">
            {routes.length === 0 ? 'No nearby buses for this trip.' : 'No buses in this class.'}
          </p>
        ) : null}
        {status === 'ready' && view === 'list'
          ? visible.map((card) => <RouteCard key={card.id} card={card} onView={openRoute} />)
          : null}
      </div>
    </section>
  )
}
