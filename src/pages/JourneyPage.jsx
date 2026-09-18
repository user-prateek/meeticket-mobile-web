import { lazy, Suspense, useCallback, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useSetAtom } from 'jotai'
import { Header } from '../components/Header'
import { SortIcon } from '../components/icons'
import { JourneyListCardSkeletons, JourneySkeleton } from '../components/skeletons/PageSkeleton'
import { SORT_DEFAULT, SORT_OPTIONS } from '../constants/journey'
import {
  formatFare,
  getLastMileMode,
  getLastMileProvider,
} from '../constants/lastMile'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useJourneyOptions, useSelectJourney } from '../hooks/useJourneyOptions'
import { GOTO_HOME_PATH } from '../lib/appContext'
import { peekOlaOauthResume } from '../lib/olaOauth'
import {
  applyFareSelectionsToJourney,
  buildInitialFareSelections,
} from '../lib/fareClasses'
import { hasRequiredTripParams, parseTripQuery } from '../lib/tripQuery'
import { journeyOptionsAtom, lastMileSelectionAtom } from '../store/journey'
import './JourneyPage.css'

/** Heavy card (brands, ola/refex) — load after shell paints. */
const RouteCard = lazy(() =>
  import('../features/srp/RouteCard').then((m) => ({ default: m.RouteCard })),
)

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

function buildLastMilePayload(optionId, change) {
  const needRide = Boolean(change?.needRide || change?.providerId || change?.vehicleId)
  if (!needRide) {
    return {
      journeyId: optionId,
      needRide: false,
      providerId: null,
      providerName: null,
      modeId: null,
      modeLabel: null,
      vehicleId: null,
      vehicleLabel: null,
      fareInr: null,
    }
  }

  const provider = getLastMileProvider(change.providerId)
  const modeId = change.vehicle?.mode || change.modeId || null
  const mode = getLastMileMode(modeId)

  return {
    journeyId: optionId,
    needRide: true,
    providerId: change.providerId || null,
    providerName: provider?.name || change.providerId || null,
    modeId,
    modeLabel: mode?.label || null,
    vehicleId: change.vehicleId || null,
    vehicleLabel: change.vehicle?.label || null,
    fareInr: change.vehicle?.fareInr ?? null,
    fareDisplay: change.vehicle?.fareDisplay || null,
    refexSearchId: change.vehicle?.searchId || null,
  }
}

function buildDetailPath(option, lastMile) {
  const params = new URLSearchParams({ id: String(option.id) })
  if (lastMile?.providerId) params.set('provider', lastMile.providerId)
  if (lastMile?.modeId) params.set('mode', lastMile.modeId)
  if (lastMile?.vehicleId) params.set('vehicle', lastMile.vehicleId)
  return `/journey-detail?${params.toString()}`
}

/**
 * /journey?from_lat&from_lon&to_lat&to_lon&from&to&mode
 * `mode` from Flutter WebView (not shown in UI): 1 metro, 2 TGSRTC, 3 multi (default).
 * Affects journey search + first-mile on this flow only.
 */
export function JourneyPage() {
  const location = useLocation()
  const navigate = useAppNavigate()
  const selectJourney = useSelectJourney()
  const setLastMileSelection = useSetAtom(lastMileSelectionAtom)
  const setJourneyOptions = useSetAtom(journeyOptionsAtom)

  const paramsOk = hasRequiredTripParams(location.search)
  const trip = useMemo(
    () => (paramsOk ? parseTripQuery(location.search) : null),
    [paramsOk, location.search],
  )
  const { options, status, error, reload } = useJourneyOptions(paramsOk ? trip : null)

  const [sortBy, setSortBy] = useState(SORT_DEFAULT)
  const [selectedId, setSelectedId] = useState(() => {
    const resume = peekOlaOauthResume()
    return resume?.kind === 'srp' && resume.journeyId != null ? resume.journeyId : null
  })
  const [lastMileByOption, setLastMileByOption] = useState({})
  const [fareSelectionsByOption, setFareSelectionsByOption] = useState({})

  const list = useMemo(() => {
    const withFares = options.map((option) => {
      const selections =
        fareSelectionsByOption[option.id] ?? buildInitialFareSelections(option.segments)
      return applyFareSelectionsToJourney(option, selections)
    })
    return sortOptionsList(withFares, sortBy)
  }, [fareSelectionsByOption, options, sortBy])
  const selected =
    (selectedId != null
      ? list.find((option) => String(option.id) === String(selectedId))
      : null) ??
    list[0] ??
    null
  const count = list.length
  const loading = count === 0 && (status === 'loading' || status === 'idle')
  const loadingMore = status === 'loading' && count > 0
  const failed = status === 'error' && count === 0

  const handleLastMileChange = useCallback((change) => {
    if (!change?.journeyId) return
    setLastMileByOption((prev) => ({
      ...prev,
      [change.journeyId]: buildLastMilePayload(change.journeyId, change),
    }))
  }, [])

  const handleFareSelectionsChange = useCallback((journeyId, selections) => {
    if (!journeyId) return
    setFareSelectionsByOption((prev) => ({
      ...prev,
      [journeyId]: selections,
    }))
  }, [])

  function journeyForNavigation(option) {
    const selections =
      fareSelectionsByOption[option.id] ?? buildInitialFareSelections(option.segments)
    return applyFareSelectionsToJourney(option, selections)
  }

  function persistJourneyOption(enriched) {
    setJourneyOptions((prev) =>
      prev.map((item) => (item.id === enriched.id ? enriched : item)),
    )
    selectJourney(enriched)
  }

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
      : count > 0
        ? `${count} Option${count === 1 ? '' : 's'} Found`
        : null

  if (loading) {
    return <JourneySkeleton subtitle={subtitle || undefined} />
  }

  function continueWith(option) {
    const lastMile = lastMileByOption[option.id] || buildLastMilePayload(option.id, null)
    const enriched = journeyForNavigation(option)
    persistJourneyOption(enriched)
    setLastMileSelection(lastMile)
    navigate(buildDetailPath(enriched, lastMile))
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
        {failed ? (
          <div className="mt-srp__empty">
            <p>{error || 'Could not load journey options.'}</p>
            <button type="button" className="mt-srp__retry" onClick={reload}>
              Retry
            </button>
          </div>
        ) : count === 0 ? (
          <p className="mt-srp__empty">No journey options found.</p>
        ) : (
          <Suspense fallback={<JourneyListCardSkeletons count={Math.min(count, 3)} />}>
            {list.map((option) => (
              <RouteCard
                key={`${option.source ?? 'journey'}-${option.id}`}
                option={option}
                selected={String(selected?.id) === String(option.id)}
                fareSelections={fareSelectionsByOption[option.id]}
                onFareSelectionsChange={(selections) =>
                  handleFareSelectionsChange(option.id, selections)
                }
                onSelect={() => setSelectedId(option.id)}
                onLastMileChange={handleLastMileChange}
              />
            ))}
            {loadingMore ? (
              <p className="mt-srp__empty mt-srp__loading-more">Loading more options…</p>
            ) : null}
          </Suspense>
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
