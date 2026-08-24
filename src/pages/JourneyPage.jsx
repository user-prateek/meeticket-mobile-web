import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Header } from '../components/Header'
import { SortIcon } from '../components/icons'
import { SORT_DEFAULT, SORT_OPTIONS } from '../constants/journey'
import { RouteCard } from '../features/srp/RouteCard'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useJourneyOptions, useSelectJourney } from '../hooks/useJourneyOptions'
import { GOTO_HOME_PATH } from '../lib/appContext'
import { hasRequiredTripParams, parseTripQuery } from '../lib/tripQuery'
import './JourneyPage.css'

function sortOptionsList(options, sortBy) {
  const next = [...options]
  next.sort((a, b) => {
    const suggested = Number(a.notSuggested) - Number(b.notSuggested)
    if (suggested !== 0) return suggested
    if (sortBy === 'time') return a.totalTimeMin - b.totalTimeMin
    if (sortBy === 'fare') return a.totalFareInr - b.totalFareInr
    if (sortBy === 'distance') return a.totalDistanceKm - b.totalDistanceKm
    if (sortBy === 'lessTransfers') return a.segments.length - b.segments.length
    return 0
  })
  return next
}

/**
 * /journey?from_lat&from_lon&to_lat&to_lon&from&to
 * Requires coords. Fetches options into Jotai and lists them.
 */
export function JourneyPage() {
  const location = useLocation()
  const navigate = useAppNavigate()
  const selectJourney = useSelectJourney()

  const paramsOk = hasRequiredTripParams(location.search)
  const trip = useMemo(
    () => (paramsOk ? parseTripQuery(location.search) : null),
    [paramsOk, location.search],
  )
  const { options, status, error, reload } = useJourneyOptions(trip)

  const [sortBy, setSortBy] = useState(SORT_DEFAULT)
  const [selectedId, setSelectedId] = useState(null)

  const list = useMemo(() => sortOptionsList(options, sortBy), [options, sortBy])
  const selected = list.find((option) => option.id === selectedId) ?? list[0] ?? null
  const count = list.length
  const loading = status === 'loading'
  const failed = status === 'error'

  function goHome() {
    // Root of the WebView flow — signal native app to close and show home.
    navigate(GOTO_HOME_PATH, { replace: true })
  }

  if (!paramsOk) {
    return (
      <section className="mt-srp">
        <Header title="Journey Options" onBack={goHome} />
        <p className="mt-srp__empty">
          Open this page with trip coordinates:
          <br />
          <code>from_lat</code>, <code>from_lon</code>, <code>to_lat</code>, <code>to_lon</code>
        </p>
      </section>
    )
  }

  const subtitle =
    trip.fromPlace && trip.toPlace
      ? `${trip.fromPlace} → ${trip.toPlace}`
      : `${count} Option${count === 1 ? '' : 's'} Found`

  function openDetails(option) {
    selectJourney(option)
    navigate(`/journey-detail?id=${option.id}`)
  }

  function continueWith(option) {
    selectJourney(option)
    navigate(`/journey-detail?id=${option.id}`)
  }

  return (
    <section className="mt-srp">
      <Header title="Journey Options" subtitle={subtitle} onBack={goHome} />

      <div className="mt-srp__sort" aria-label="Sort journey options">
        <span className="mt-srp__sort-label">
          <SortIcon size={14} />
          Sort By:
        </span>
        <div className="mt-srp__sort-chips">
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={`mt-srp__sort-chip${sortBy === option.id ? ' is-active' : ''}`}
              onClick={() => setSortBy(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-srp__list">
        {loading ? (
          <p className="mt-srp__empty">Finding journey options…</p>
        ) : failed ? (
          <div className="mt-srp__empty">
            <p>{error || 'Could not load journey options.'}</p>
            <button type="button" className="mt-srp__retry" onClick={reload}>
              Retry
            </button>
          </div>
        ) : count === 0 ? (
          <p className="mt-srp__empty">No journey options found.</p>
        ) : (
          list.map((option) => (
            <RouteCard
              key={option.id}
              option={option}
              selected={selected?.id === option.id}
              onSelect={() => setSelectedId(option.id)}
              onOpenDetails={() => openDetails(option)}
            />
          ))
        )}
      </div>

      <div className="mt-srp__footer">
        <button
          type="button"
          className="mt-srp__cta"
          disabled={!selected || loading || failed}
          onClick={() => selected && continueWith(selected)}
        >
          Continue with selected
        </button>
      </div>
    </section>
  )
}
