import { useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Header } from '../components/Header'
import { FareClassPanel } from '../components/FareClassPanel'
import { ChevronIcon, ClockIcon, ModeIcon, OnlinePayIcon, PinIcon } from '../components/icons'
import {
  LAST_MILE_MODE_DEFAULT,
  LAST_MILE_MODES,
  LAST_MILE_PROVIDERS,
  coerceEnabledProviderId,
  findLastMileVehicle,
  formatVehicleEta,
  formatVehicleFare,
  getLastMileMode,
  getLastMileProvider,
  getProviderCardSlots,
  isProviderDisabledForMode,
  isProviderEnabled,
  providerDisabledReason,
} from '../constants/lastMile'
import { metroLineFromRouteId } from '../constants/metroLines'
import { getOlaRideEstimateForJourneyCached } from '../api/ola'
import { searchRefexForJourney } from '../api/refex'
import { buildOrderPayload, createOrderAndInitiatePg, hasFirstMileLeg } from '../api/orders'
import { formatMetroStationName } from '../api/journey'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { useJourneyOptionById, useSelectJourney } from '../hooks/useJourneyOptions'
import { withAppContext } from '../lib/appContext'
import {
  applyFareSelectionsToJourney,
  buildInitialFareSelections,
  cheapestFareOptionId,
} from '../lib/fareClasses'
import { tripToSearch } from '../lib/tripQuery'
import { journeyOptionsAtom, lastMileSelectionAtom, orderAtom, tripAtom, userAtom } from '../store/journey'
import olaLogo from '../assets/brands/ola.png'
import rapidoLogo from '../assets/brands/rapido.png'
import refexLogo from '../assets/brands/refex.png'
import './JourneyDetailPage.css'

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

function displayStationName(name, mode) {
  if (mode !== 'metro') return name
  return formatMetroStationName(name)
}

function vehicleMetaParts(vehicle) {
  const eta = formatVehicleEta(vehicle)
  const fare = formatVehicleFare(vehicle) || null
  return { eta, fare, peak: Boolean(vehicle.peak) }
}

function VehicleSlotMeta({ label, eta, fare, peak }) {
  const parts = []
  if (eta) {
    parts.push(
      <span key="eta" className="mt-provider-options__eta">
        {eta}
      </span>,
    )
  }
  if (label) {
    parts.push(
      <span key="label" className="mt-provider-options__label">
        {label}
      </span>,
    )
  }
  if (fare) {
    parts.push(
      <span key="fare" className="mt-provider-options__fare">
        {fare}
      </span>,
    )
  }
  if (peak) {
    parts.push(
      <span key="peak" className="mt-provider-options__peak">
        Peak
      </span>,
    )
  }

  return (
    <span className="mt-provider-options__meta">
      {parts.map((part, index) => (
        <span key={part.key} className="mt-provider-options__meta-item">
          {index > 0 ? (
            <span className="mt-provider-options__dot" aria-hidden="true">
              •
            </span>
          ) : null}
          {part}
        </span>
      ))}
    </span>
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

function resolveLastMileSelection(params, stored) {
  const journeyId = Number(params.get('id'))
  const rawProviderId = params.get('provider') || stored?.providerId || null
  const providerId = coerceEnabledProviderId(rawProviderId, { fallback: null })
  const modeId = providerId
    ? params.get('mode') || stored?.modeId || null
    : null
  const vehicleId = providerId
    ? params.get('vehicle') || stored?.vehicleId || null
    : null

  if (
    providerId &&
    stored &&
    Number(stored.journeyId) === journeyId &&
    stored.providerId === providerId
  ) {
    if ((stored.vehicleId || null) === (vehicleId || null)) {
      return {
        journeyId,
        providerId: stored.providerId,
        providerName: stored.providerName,
        modeId: stored.modeId,
        modeLabel: stored.modeLabel,
        vehicleId: stored.vehicleId,
        vehicleLabel: stored.vehicleLabel,
        fareInr: stored.fareInr,
      }
    }
  }

  if (!providerId) {
    return {
      journeyId,
      providerId: null,
      providerName: null,
      modeId: null,
      modeLabel: null,
      vehicleId: null,
      vehicleLabel: null,
      fareInr: null,
    }
  }

  const provider = getLastMileProvider(providerId)
  const mode = getLastMileMode(modeId)
  const vehicle = findLastMileVehicle(providerId, vehicleId)

  return {
    journeyId,
    providerId,
    providerName: provider?.name || providerId,
    modeId: vehicle?.mode || modeId,
    modeLabel: getLastMileMode(vehicle?.mode || modeId)?.label || mode?.label || null,
    vehicleId,
    vehicleLabel: vehicle?.label || null,
    fareInr: vehicle?.fareInr ?? null,
  }
}

function buildLastMilePayload(journeyId, { providerId, vehicle }) {
  const provider = getLastMileProvider(providerId)
  const modeId = vehicle?.mode || null
  const mode = getLastMileMode(modeId)
  return {
    journeyId,
    providerId: providerId || null,
    providerName: provider?.name || providerId || null,
    modeId,
    modeLabel: mode?.label || null,
    vehicleId: vehicle?.id || null,
    vehicleLabel: vehicle?.label || null,
    fareInr: vehicle?.fareInr ?? null,
    fareDisplay: vehicle?.fareDisplay || null,
    refexSearchId: vehicle?.searchId || null,
  }
}

function LegCard({
  segment,
  fareSelections,
  fareExpanded,
  onToggleFarePanel,
  onSelectFare,
}) {
  const title = segment.title || segment.detailTitle
  const isBus = segment.mode === 'bus'
  const hasFareOptions = isBus && segment.fareOptions?.length > 1
  const selectedFareId =
    fareSelections?.[segment.id] ||
    cheapestFareOptionId(segment.fareOptions) ||
    segment.fareOptions?.[0]?.id
  const line =
    segment.mode === 'metro'
      ? metroLineFromRouteId(segment.routeId || segment.routeShortName || title)
      : null
  const markerStyle = line
    ? { background: line.hex }
    : segment.mode === 'bus'
      ? { background: 'var(--mt-bus)' }
      : { background: 'var(--mt-metro)' }
  const railStyle = line
    ? { background: `color-mix(in srgb, ${line.hex} 35%, #d5dae2)` }
    : undefined

  return (
    <article className={`mt-leg is-${segment.mode}`}>
      <div className="mt-leg__head">
        <ModeIcon mode={segment.mode} size={32} className="mt-leg__badge" />
        <strong>{title}</strong>
        <div className="mt-leg__fare-wrap">
          {segment.fareInr != null ? (
            <span className="mt-leg__fare">₹{segment.fareInr}</span>
          ) : null}
          {hasFareOptions ? (
            <button
              type="button"
              className={`mt-fare-toggle is-bus${fareExpanded ? ' is-open' : ''}`}
              aria-expanded={fareExpanded}
              aria-label={fareExpanded ? 'Hide fare classes' : 'Show fare classes'}
              onClick={() => onToggleFarePanel?.(segment.id)}
            >
              {fareExpanded ? '−' : '+'}
            </button>
          ) : null}
        </div>
      </div>

      {hasFareOptions && fareExpanded ? (
        <FareClassPanel
          className="mt-leg__fare-panel"
          segmentId={segment.id}
          options={segment.fareOptions}
          selectedId={selectedFareId}
          side="end"
          ariaLabel={`${title} fare classes`}
          onSelect={(optionId) => onSelectFare?.(segment.id, optionId)}
        />
      ) : null}

      <div className="mt-leg__body">
        <div className="mt-leg__duration">
          <ClockIcon className="mt-leg__clock" />
          <span>{segment.durationMin} Min</span>
        </div>

        {segment.from && segment.to ? (
          <div className="mt-leg__stops">
            <div className="mt-leg__stop mt-leg__stop--from">
              <div className="mt-leg__icon-col" aria-hidden="true">
                <span className="mt-stop__dot" style={markerStyle} />
                <span className="mt-stop__line" style={railStyle} />
              </div>
              <div className="mt-leg__stop-text">
                <span>{displayStationName(segment.from, segment.mode)}</span>
                <small>Boarding</small>
              </div>
            </div>
            <div className="mt-leg__stop mt-leg__stop--to">
              <div className="mt-leg__icon-col" aria-hidden="true">
                <span className="mt-stop__sq" style={markerStyle} />
              </div>
              <div className="mt-leg__stop-text">
                <span>{displayStationName(segment.to, segment.mode)}</span>
                <small>Alighting</small>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </article>
  )
}

function WalkCard({ from, to, durationMin, distanceM }) {
  const distancePart = distanceM != null ? ` (${distanceM} m)` : ''
  return (
    <article className="mt-walk-card">
      <ModeIcon mode="walk" size={32} className="mt-leg__badge" />
      <div className="mt-walk-card__copy">
        <strong>
          Walk {durationMin || 0} Min{distancePart}
        </strong>
        {from && to ? (
          <p>
            from {from} to {to}
          </p>
        ) : null}
      </div>
    </article>
  )
}

function detailBlocks(journey) {
  const blocks = []
  const segments = journey.segments || []

  segments.forEach((segment, index) => {
    if (segment.mode === 'interchange') {
      blocks.push({
        type: 'walk',
        id: segment.id,
        from: segment.from,
        to: segment.to,
        durationMin: segment.durationMin || 5,
        distanceM: segment.distanceM ?? null,
      })
      return
    }

    if (segment.mode === 'walk') {
      blocks.push({
        type: 'walk',
        id: segment.id,
        from: segment.from,
        to: segment.to,
        durationMin: segment.durationMin,
        distanceM: segment.distanceM ?? null,
      })
      return
    }

    const prev = segments[index - 1]
    if (
      prev &&
      (prev.mode === 'metro' || prev.mode === 'bus') &&
      (segment.mode === 'metro' || segment.mode === 'bus') &&
      prev.mode !== segment.mode
    ) {
      blocks.push({
        type: 'walk',
        id: `walk-${prev.id}-${segment.id}`,
        from: prev.to,
        to: segment.from,
        durationMin: 5,
        distanceM: 400,
      })
    }

    blocks.push({ type: 'leg', id: segment.id, segment })
  })

  return blocks
}

function PickupServiceCard({
  destinationLabel,
  modeId,
  providerId,
  selectedVehicleId,
  slots,
  status,
  error,
  showProviders,
  onSelectMode,
  onSelectVehicle,
  onSelectProvider,
  onCheckOthers,
}) {
  const hasProvider = Boolean(providerId)
  const hasSlots = slots.some(Boolean)

  if (showProviders) {
    return (
      <article className="mt-pickup mt-pickup--browse">
        <div className="mt-pickup__dest">
          <strong className="mt-pickup__dest-title">Need ride to</strong>
          <div className="mt-pickup__dest-divider" aria-hidden="true" />
          <div className="mt-pickup__dest-row">
            <PinIcon size={16} className="mt-pickup__pin" />
            <span className="mt-pickup__dest-station">{destinationLabel}</span>
          </div>
        </div>

        <div className="mt-pickup__modes" role="group" aria-label="Vehicle type">
          {LAST_MILE_MODES.map((mode) => {
            const active = modeId === mode.id
            return (
              <button
                key={mode.id}
                type="button"
                className={`mt-pickup__mode${active ? ' is-selected' : ''}`}
                onClick={() => onSelectMode(mode.id)}
              >
                <ModeIcon
                  mode={mode.id}
                  size={18}
                  color={active ? 'var(--mt-primary)' : '#666666'}
                  className="mt-pickup__mode-icon"
                />
                {mode.label}
              </button>
            )
          })}
        </div>

        <div className="mt-pickup__providers" role="list" aria-label="Ride providers">
          {LAST_MILE_PROVIDERS.map((provider) => {
            const disabled = isProviderDisabledForMode(provider.id, modeId)
            const active = providerId === provider.id
            return (
              <button
                key={provider.id}
                type="button"
                role="listitem"
                disabled={disabled}
                aria-disabled={disabled || undefined}
                title={providerDisabledReason(provider.id, modeId)}
                className={`mt-pickup__provider${active ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
                onClick={() => onSelectProvider(provider.id)}
              >
                <BrandLogo id={provider.id} name={provider.name} />
              </button>
            )
          })}
        </div>
      </article>
    )
  }

  return (
    <article className="mt-pickup">
      <div className="mt-pickup__head">
        <strong>Pickup Service</strong>
        {hasProvider ? (
          <button type="button" className="mt-pickup__more" onClick={onCheckOthers}>
            Check Others
          </button>
        ) : null}
      </div>

      {!hasProvider ? (
        <p className="mt-pickup__empty">None selected</p>
      ) : status === 'loading' ? (
        <p className="mt-pickup__empty">Searching options…</p>
      ) : status === 'error' ? (
        <p className="mt-pickup__empty">{error || 'Could not load options.'}</p>
      ) : !hasSlots ? (
        <p className="mt-pickup__empty">No vehicles for this provider.</p>
      ) : (
        <div className="mt-provider-options" role="list" aria-label="Pickup vehicle options">
          {slots.filter(Boolean).map((vehicle) => {
            const active = selectedVehicleId === vehicle.id
            const { eta, fare, peak } = vehicleMetaParts(vehicle)

            return (
              <button
                key={vehicle.id}
                type="button"
                role="listitem"
                aria-pressed={active}
                className={`mt-provider-options__cell${active ? ' is-selected' : ''}${vehicle.unavailable ? ' is-unavailable' : ''}`}
                onClick={() => onSelectVehicle(vehicle)}
                disabled={vehicle.unavailable || undefined}
              >
                {active ? <VehicleCheckBadge /> : null}
                <div className="mt-provider-options__row">
                  <BrandLogo id={providerId} name={providerId} />
                  <ModeIcon mode={vehicle.mode} size={16} className="mt-provider-options__mode-icon" />
                </div>
                <VehicleSlotMeta label={vehicle.label} eta={eta} fare={fare} peak={peak} />
              </button>
            )
          })}
        </div>
      )}
    </article>
  )
}

function JourneyDetailView({
  journey,
  lastMile,
  destinationLabel,
  modeId,
  slots,
  slotStatus,
  slotError,
  selectedVehicleId,
  showProviders,
  totalFareInr,
  confirmLoading,
  confirmError,
  fareSelections,
  collapsedFareSegments,
  onToggleFarePanel,
  onSelectFare,
  onBack,
  onConfirm,
  onCheckOthers,
  onSelectMode,
  onSelectProvider,
  onSelectVehicle,
}) {
  const blocks = useMemo(() => detailBlocks(journey), [journey])

  return (
    <section className="mt-details-page">
      <Header title="Journey Detail" onBack={onBack} />
      <div className="mt-details-page__scroll">
        <div className="mt-details-page__body">
          {journey.notSuggested && journey.note ? (
            <p className="mt-details-page__hint">{journey.note}</p>
          ) : null}

          {blocks.map((block) =>
            block.type === 'walk' ? (
              <WalkCard
                key={block.id}
                from={block.from}
                to={block.to}
                durationMin={block.durationMin}
                distanceM={block.distanceM}
              />
            ) : (
              <LegCard
                key={block.id}
                segment={block.segment}
                fareSelections={fareSelections}
                fareExpanded={!collapsedFareSegments.has(block.segment.id)}
                onToggleFarePanel={onToggleFarePanel}
                onSelectFare={onSelectFare}
              />
            ),
          )}

          <PickupServiceCard
            destinationLabel={destinationLabel}
            modeId={modeId}
            providerId={lastMile.providerId}
            selectedVehicleId={selectedVehicleId}
            slots={slots}
            status={slotStatus}
            error={slotError}
            showProviders={showProviders}
            onSelectMode={onSelectMode}
            onSelectVehicle={onSelectVehicle}
            onSelectProvider={onSelectProvider}
            onCheckOthers={onCheckOthers}
          />
        </div>
      </div>

      <div className="mt-details-page__panel">
        <button type="button" className="mt-pay">
          <OnlinePayIcon size={28} />
          <span>{journey.payment?.method || 'Online'}</span>
          <strong>₹{totalFareInr}</strong>
          <ChevronIcon size={18} className="mt-pay__chevron" />
        </button>
        <button
          type="button"
          className="mt-details-page__cta"
          onClick={onConfirm}
          disabled={confirmLoading}
        >
          {confirmLoading ? 'Creating order…' : 'Confirm Multi Model'}
        </button>
        {confirmError ? <p className="mt-details-page__confirm-error">{confirmError}</p> : null}
      </div>
    </section>
  )
}

/**
 * /journey-detail?id=1&provider=rapido&mode=cab&vehicle=rapido_cab_economy
 */
export function JourneyDetailPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useAppNavigate()
  const trip = useAtomValue(tripAtom)
  const user = useAtomValue(userAtom)
  const [storedLastMile, setLastMileSelection] = useAtom(lastMileSelectionAtom)
  const setOrder = useSetAtom(orderAtom)
  const setJourneyOptions = useSetAtom(journeyOptionsAtom)
  const selectJourney = useSelectJourney()
  const id = params.get('id')
  const journey = useJourneyOptionById(id)

  const initialLastMile = useMemo(
    () => resolveLastMileSelection(params, storedLastMile),
    [params, storedLastMile],
  )

  const [providerId, setProviderId] = useState(initialLastMile.providerId)
  const [selectedVehicleId, setSelectedVehicleId] = useState(initialLastMile.vehicleId)
  const [modeId, setModeId] = useState(
    () => initialLastMile.modeId || LAST_MILE_MODE_DEFAULT,
  )
  const [showProviders, setShowProviders] = useState(() => !initialLastMile.providerId)
  const [refexVehicles, setRefexVehicles] = useState([])
  const [olaVehicles, setOlaVehicles] = useState([])
  const [slotStatus, setSlotStatus] = useState('idle')
  const [slotError, setSlotError] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmError, setConfirmError] = useState('')
  const [fareSelections, setFareSelections] = useState({})
  const [collapsedFareSegments, setCollapsedFareSegments] = useState(() => new Set())

  useEffect(() => {
    if (!journey) return
    setFareSelections(journey.fareSelections ?? buildInitialFareSelections(journey.segments))
    setCollapsedFareSegments(new Set())
  }, [journey?.id])

  const journeyWithFares = useMemo(
    () => (journey ? applyFareSelectionsToJourney(journey, fareSelections) : null),
    [fareSelections, journey],
  )

  useEffect(() => {
    setProviderId(initialLastMile.providerId)
    setSelectedVehicleId(initialLastMile.vehicleId)
    setModeId(initialLastMile.modeId || LAST_MILE_MODE_DEFAULT)
  }, [initialLastMile.providerId, initialLastMile.vehicleId, initialLastMile.modeId, journey?.id])

  useEffect(() => {
    setShowProviders(!initialLastMile.providerId)
  }, [journey?.id])

  const destinationLabel = useMemo(() => {
    const raw =
      journey?.access?.toLabel ||
      journey?.originStation ||
      journey?.stops?.[0]?.from ||
      'Station'
    const mode = journey?.stops?.[0]?.mode
    return displayStationName(raw, mode)
  }, [journey])

  useEffect(() => {
    if (providerId !== 'refex') {
      return undefined
    }

    const controller = new AbortController()
    setSlotStatus('loading')
    setSlotError('')

    searchRefexForJourney({ journey, trip, serviceId: 'pickup' }, { signal: controller.signal })
      .then((result) => {
        setRefexVehicles(result.vehicles)
        setSlotStatus('ready')
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setRefexVehicles([])
        setSlotStatus('error')
        setSlotError(error.message || 'Refex search failed')
      })

    return () => controller.abort()
  }, [providerId, journey, trip])

  useEffect(() => {
    if (providerId !== 'ola' || !isProviderEnabled('ola')) {
      return undefined
    }

    const controller = new AbortController()
    setOlaVehicles([])
    setSlotStatus('loading')
    setSlotError('')

    getOlaRideEstimateForJourneyCached({
      journey,
      trip,
      serviceId: 'pickup',
      signal: controller.signal,
      refresh: true,
    })
      .then((result) => {
        if (controller.signal.aborted) return
        setOlaVehicles(result.vehicles)
        setSlotStatus('ready')
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setOlaVehicles([])
        setSlotStatus('error')
        setSlotError(error.message || 'Could not load Ola ride estimates.')
      })

    return () => controller.abort()
  }, [providerId, journey, trip])

  const liveVehicles =
    providerId === 'refex' ? refexVehicles : providerId === 'ola' ? olaVehicles : undefined

  const slots = useMemo(() => {
    if (!providerId) return []
    return getProviderCardSlots(providerId, liveVehicles)
  }, [providerId, liveVehicles])

  const selectedVehicle = useMemo(
    () => slots.find((vehicle) => vehicle?.id === selectedVehicleId) || null,
    [slots, selectedVehicleId],
  )

  const lastMile = useMemo(
    () => buildLastMilePayload(Number(id), { providerId, vehicle: selectedVehicle }),
    [id, providerId, selectedVehicle],
  )

  const totalFareInr = useMemo(() => {
    const transit =
      Number(journeyWithFares?.payment?.amountInr) ||
      Number(journeyWithFares?.totalFareInr) ||
      0
    const ride = selectedVehicle?.fareInr != null ? Number(selectedVehicle.fareInr) : 0
    return Math.round(transit + ride)
  }, [journeyWithFares, selectedVehicle])

  function persistFareSelections(nextSelections) {
    if (!journey) return
    setFareSelections(nextSelections)
    setJourneyOptions((prev) => {
      const current = prev.find((item) => item.id === journey.id) || journey
      const enriched = applyFareSelectionsToJourney(current, nextSelections)
      selectJourney(enriched)
      return prev.map((item) => (item.id === enriched.id ? enriched : item))
    })
  }

  function handleSelectFare(segmentId, optionId) {
    persistFareSelections({
      ...fareSelections,
      [segmentId]: optionId,
    })
  }

  function handleToggleFarePanel(segmentId) {
    setCollapsedFareSegments((prev) => {
      const next = new Set(prev)
      if (next.has(segmentId)) next.delete(segmentId)
      else next.add(segmentId)
      return next
    })
  }

  if (!journey || !journeyWithFares) {
    const fallback = trip ? `/journey${tripToSearch(trip)}` : '/journey'
    return <Navigate to={withAppContext(fallback)} replace />
  }

  function syncSelection(nextProviderId, nextVehicle, nextModeId) {
    const payload = buildLastMilePayload(journey.id, {
      providerId: nextProviderId,
      vehicle: nextVehicle,
    })
    if (!payload.modeId && nextModeId) {
      payload.modeId = nextModeId
      payload.modeLabel = getLastMileMode(nextModeId)?.label || null
    }
    setLastMileSelection(payload)

    const next = new URLSearchParams({ id: String(journey.id) })
    if (payload.providerId) next.set('provider', payload.providerId)
    if (payload.modeId || nextModeId) next.set('mode', payload.modeId || nextModeId)
    if (payload.vehicleId) next.set('vehicle', payload.vehicleId)
    setParams(next, { replace: true })
  }

  function handleSelectVehicle(vehicle) {
    const nextId = selectedVehicleId === vehicle.id ? null : vehicle.id
    const nextVehicle = nextId ? vehicle : null
    setSelectedVehicleId(nextId)
    if (nextVehicle?.mode) setModeId(nextVehicle.mode)
    syncSelection(providerId, nextVehicle)
  }

  function handleCheckOthers() {
    setShowProviders(true)
  }

  function handleSelectMode(nextModeId) {
    if (nextModeId === modeId) return
    setModeId(nextModeId)
    if (providerId && isProviderDisabledForMode(providerId, nextModeId)) {
      setProviderId(null)
      setSelectedVehicleId(null)
      syncSelection(null, null, nextModeId)
      return
    }
    setSelectedVehicleId(null)
    syncSelection(providerId, null, nextModeId)
  }

  function handleSelectProvider(nextProviderId) {
    if (!isProviderEnabled(nextProviderId) || isProviderDisabledForMode(nextProviderId, modeId)) {
      return
    }
    setProviderId(nextProviderId)
    setSelectedVehicleId(null)
    setShowProviders(false)
    syncSelection(nextProviderId, null, modeId)
  }

  function cabPath(serviceId = 'pickup') {
    const next = new URLSearchParams({
      id: String(journey.id),
      service: serviceId,
    })
    if (lastMile.providerId) next.set('provider', lastMile.providerId)
    if (lastMile.modeId || modeId) next.set('mode', lastMile.modeId || modeId)
    if (lastMile.vehicleId) next.set('vehicle', lastMile.vehicleId)
    return `/cab?${next.toString()}`
  }

  function paymentPath() {
    return `/payment?id=${String(journey.id)}`
  }

  async function handleConfirm() {
    if (confirmLoading) return
    setConfirmError('')
    setConfirmLoading(true)

    try {
      selectJourney(journeyWithFares)

      // Cab selected → review/book first-mile, then payment. Else → pay now.
      if (hasFirstMileLeg({ lastMile, selectedVehicle })) {
        setLastMileSelection(lastMile)
        navigate(cabPath('pickup'), { replace: true })
        return
      }

      const payload = await buildOrderPayload({
        journey: journeyWithFares,
        trip,
        lastMile,
        selectedVehicle,
        user,
      })
      const order = await createOrderAndInitiatePg(payload, { journeyId: journeyWithFares.id })
      setOrder(order)
      navigate(paymentPath(), { replace: true })
    } catch (error) {
      if (error?.name === 'AbortError') return
      if (import.meta.env.DEV && error?.body) {
        console.error('[orders] create failed', error.status, error.body)
      }
      setConfirmError(error?.message || 'Could not create order or start payment')
    } finally {
      setConfirmLoading(false)
    }
  }

  function backToJourney() {
    setLastMileSelection(lastMile)
    navigate(trip ? `/journey${tripToSearch(trip)}` : '/journey')
  }

  return (
    <JourneyDetailView
      journey={journeyWithFares}
      lastMile={lastMile}
      destinationLabel={destinationLabel}
      modeId={modeId}
      slots={slots}
      slotStatus={slotStatus}
      slotError={slotError}
      selectedVehicleId={selectedVehicleId}
      showProviders={showProviders}
      totalFareInr={totalFareInr}
      confirmLoading={confirmLoading}
      confirmError={confirmError}
      fareSelections={fareSelections}
      collapsedFareSegments={collapsedFareSegments}
      onToggleFarePanel={handleToggleFarePanel}
      onSelectFare={handleSelectFare}
      onBack={backToJourney}
      onConfirm={handleConfirm}
      onCheckOthers={handleCheckOthers}
      onSelectMode={handleSelectMode}
      onSelectProvider={handleSelectProvider}
      onSelectVehicle={handleSelectVehicle}
    />
  )
}
