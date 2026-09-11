import { useEffect, useMemo, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { Header } from '../components/Header'
import { FareClassPanel } from '../components/FareClassPanel'
import { ChevronIcon, ClockIcon, CashBillIcon, ModeIcon, OnlinePayIcon, PinIcon, MetroGlyph, BusGlyph, WalkIcon } from '../components/icons'
import {
  LAST_MILE_MODE_DEFAULT,
  LAST_MILE_PROVIDERS,
  coerceEnabledProviderId,
  findLastMileVehicle,
  formatVehicleEta,
  formatVehicleFare,
  getLastMileMode,
  getLastMileProvider,
  isPayAtPickupVehicle,
  isProviderDisabledForMode,
  isProviderEnabled,
  onlineFareInrFromVehicle,
  providerDisabledReason,
  summarizeProviderModes,
} from '../constants/lastMile'
import { metroLineFromRouteId } from '../constants/metroLines'
import { LAST_MILE_OPTIONS } from '../constants/journey'
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
  formatSegmentFareRange,
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

function BrandLogo({ id, name, className = '' }) {
  const src = BRAND_LOGO[id]
  const classes = `mt-brand mt-brand--${id} ${className}`.trim()
  if (!src) return <span className={classes}>{name}</span>
  return <img className={classes} src={src} alt={name} draggable={false} />
}

function displayStationName(name, mode) {
  if (mode !== 'metro') return name
  return formatMetroStationName(name)
}

function vehicleMetaParts(vehicle) {
  const eta = vehicle?.timeDisplay || formatVehicleEta(vehicle)
  const fare = formatVehicleFare(vehicle) || null
  return { eta, fare, peak: Boolean(vehicle?.peak) }
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
  const needRide = Boolean(
    stored?.needRide || providerId || params.get('provider') || params.get('mode'),
  )
  const modeId =
    params.get('mode') ||
    (needRide ? stored?.modeId : null) ||
    null
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
        needRide: true,
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

  if (!providerId && !needRide) {
    return {
      journeyId,
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

  const provider = getLastMileProvider(providerId)
  const mode = getLastMileMode(modeId)
  const vehicle = findLastMileVehicle(providerId, vehicleId)

  return {
    journeyId,
    needRide: true,
    providerId,
    providerName: provider?.name || providerId,
    modeId: vehicle?.mode || modeId,
    modeLabel: getLastMileMode(vehicle?.mode || modeId)?.label || mode?.label || null,
    vehicleId,
    vehicleLabel: vehicle?.label || null,
    fareInr: vehicle?.fareInr ?? null,
  }
}

function buildLastMilePayload(journeyId, { providerId, vehicle, needRide = false, modeId = null }) {
  const wantsRide = Boolean(needRide || providerId || vehicle)
  const provider = getLastMileProvider(providerId)
  const isSummary = Boolean(vehicle?.isModeSummary)
  const resolvedModeId = vehicle?.mode || modeId || null
  const mode = getLastMileMode(resolvedModeId)
  return {
    journeyId,
    needRide: wantsRide,
    providerId: wantsRide ? providerId || null : null,
    providerName: wantsRide ? provider?.name || providerId || null : null,
    modeId: wantsRide ? resolvedModeId : null,
    modeLabel: wantsRide ? mode?.label || null : null,
    // Mode summaries are not a concrete category — Cab page lists categories.
    vehicleId: wantsRide && vehicle && !isSummary ? vehicle.id : null,
    vehicleLabel: wantsRide
      ? isSummary
        ? vehicle.modeLabel || mode?.label || vehicle.label || null
        : vehicle?.label || null
      : null,
    fareInr: wantsRide ? vehicle?.fareInr ?? null : null,
    fareMaxInr: wantsRide ? vehicle?.fareMaxInr ?? null : null,
    fareDisplay: wantsRide ? vehicle?.fareDisplay || null : null,
    payAtPickup: wantsRide ? Boolean(vehicle?.payAtPickup || providerId === 'ola') : false,
    refexSearchId: wantsRide && !isSummary ? vehicle?.searchId || null : null,
  }
}

function metroLineTitle(line) {
  if (!line?.id) return null
  return `${line.id} line metro`
}

function LegModeCapsule({ segment, line }) {
  const isBus = segment.mode === 'bus'
  const label = isBus ? segment.title || 'TGSRTC' : 'Metro'
  const capsuleStyle =
    !isBus && line?.hex ? { background: line.hex } : undefined
  const Glyph = isBus ? BusGlyph : MetroGlyph

  return (
    <div className={`mt-capsule is-${segment.mode}`} style={capsuleStyle}>
      <Glyph size={13} className="mt-capsule__icon" />
      <span className="mt-capsule__label">{label}</span>
    </div>
  )
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
  const hasFareOptions = isBus && segment.fareOptions?.length > 0
  const selectedFareId =
    fareSelections?.[segment.id] ||
    cheapestFareOptionId(segment.fareOptions) ||
    segment.fareOptions?.[0]?.id
  const line =
    segment.mode === 'metro'
      ? metroLineFromRouteId(segment.routeId || segment.routeShortName || title)
      : null
  const lineTitle = metroLineTitle(line)
  const busFareRange = isBus ? formatSegmentFareRange(segment) : null
  const metroFare =
    !isBus && segment.fareInr != null ? `₹${segment.fareInr}` : null
  const fareText = isBus ? busFareRange : metroFare
  const markerStyle = line
    ? { background: line.hex }
    : segment.mode === 'bus'
      ? { background: 'var(--mt-bus)' }
      : { background: 'var(--mt-metro)' }
  const railStyle = line
    ? { background: `color-mix(in srgb, ${line.hex} 35%, #d5dae2)` }
    : undefined
  const fareColorStyle = line?.hex
    ? { color: line.hex }
    : isBus
      ? { color: 'var(--mt-bus)' }
      : undefined
  const cardStyle = isBus
    ? undefined
    : line?.hex
      ? {
          borderColor: line.hex,
          ['--leg-accent']: line.hex,
        }
      : undefined

  return (
    <article className={`mt-leg is-${segment.mode}`} style={cardStyle}>
      <div className="mt-leg__head">
        <LegModeCapsule segment={segment} line={line} />
        {lineTitle ? (
          <span className="mt-leg__line-name" style={fareColorStyle}>
            {lineTitle}
          </span>
        ) : (
          <span className="mt-leg__head-spacer" aria-hidden="true" />
        )}
        <div className="mt-leg__fare-wrap">
          {fareText ? (
            <span className="mt-leg__fare" style={fareColorStyle}>
              {fareText}
            </span>
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
          className="mt-transit-fare__panel"
          groupId={segment.id}
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
      <WalkIcon size={32} className="mt-walk-card__icon" />
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

function formatAccessKm(distanceM) {
  const meters = Number(distanceM)
  if (!Number.isFinite(meters) || meters <= 0) return null
  const km = Math.round(meters / 100) / 10
  return km > 0 ? `${km} KM` : null
}

function firstTransitHop(segments = []) {
  return segments.find((segment) => segment.mode === 'metro' || segment.mode === 'bus') || null
}

function transitAccentHex(segment) {
  if (!segment) return null
  if (segment.mode === 'bus') return null
  if (segment.mode === 'metro') {
    return metroLineFromRouteId(segment.routeId || segment.routeShortName)?.hex || null
  }
  return null
}

/** Dashed connector from distance down toward first transit leg. */
/** Journey-detail first-mile connector (same arrow checked or unchecked). */
function AccessArrow() {
  // Cubic end tangent ≈ (14, 42) → tip points down-right along the stroke.
  return (
    <svg
      className="mt-pickup__arrow"
      width="32"
      height="160"
      viewBox="0 0 32 160"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M13 1C3 45 0 100 14 142"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="2.5 2.5"
      />
      <path d="M16.85 150.55 10.05 143.35 17.95 140.65Z" fill="currentColor" />
    </svg>
  )
}

/**
 * First-mile box (design):
 * 1) checkbox + "Need ride from" (+ Check Others when a provider is selected)
 * 2) pin + km + from place
 * then Cab/Auto/Bike + aggregators (always visible; disabled when unchecked)
 * or vehicle slots after an aggregator is chosen
 */
function PickupServiceCard({
  journey,
  trip,
  needRide,
  modeId,
  providerId,
  selectedVehicleId,
  slots,
  status,
  error,
  showProviders,
  onToggleNeedRide,
  onSelectMode,
  onSelectVehicle,
  onSelectProvider,
  onCheckOthers,
}) {
  const hasSlots = slots.some(Boolean)
  const showVehicleSlots = Boolean(needRide && providerId && !showProviders)
  const controlsDisabled = !needRide
  // When aggregator options are open, modes only hold layout — not interactive.
  const modesDisabled = controlsDisabled || showVehicleSlots

  const fromPlaceLabel = trip?.fromPlace || journey?.access?.fromLabel || 'Current location'
  const accessKmLabel = formatAccessKm(journey?.access?.distanceM)
  const firstHop = firstTransitHop(journey?.segments)
  const accessLineHex = transitAccentHex(firstHop)
  const accessAccent =
    firstHop?.mode === 'bus' ? 'var(--mt-bus)' : accessLineHex || 'var(--mt-navy)'

  const rideModes = journey?.lastMileOptions?.length
    ? journey.lastMileOptions
    : LAST_MILE_OPTIONS

  let providerEmptyMessage = 'No options for this mode.'
  if (providerId === 'refex') {
    if (modeId !== 'cab') providerEmptyMessage = 'Refex is available for cab only.'
    else if (status === 'loading') providerEmptyMessage = 'Searching Refex…'
    else if (status === 'error') providerEmptyMessage = error || 'Refex search failed.'
  } else if (providerId === 'ola') {
    if (status === 'loading') providerEmptyMessage = 'Getting Ola estimates…'
    else if (status === 'error') providerEmptyMessage = error || 'Could not load Ola estimates.'
    else providerEmptyMessage = 'No Ola rides available near this pickup.'
  } else if (status === 'loading') {
    providerEmptyMessage = 'Searching options…'
  } else if (status === 'error') {
    providerEmptyMessage = error || 'Could not load options.'
  }

  return (
    <article
      className={`mt-pickup${needRide ? ' is-need-ride' : ''}${controlsDisabled ? ' is-ride-off' : ''}${showVehicleSlots ? ' is-options-open' : ''}`}
      style={{ '--mt-access-accent': accessAccent }}
    >
      {/* Line 1: checkbox + label (+ Check Others when vehicles shown) */}
      <div className="mt-pickup__line1">
        <label className="mt-pickup__check">
          <span className="mt-pickup__check-input">
            <input type="checkbox" checked={needRide} onChange={onToggleNeedRide} />
          </span>
          <span>Need ride from</span>
        </label>
        {showVehicleSlots ? (
          <button type="button" className="mt-pickup__more" onClick={onCheckOthers}>
            Check Others
          </button>
        ) : null}
      </div>

      {/* Line 2: pin + km (left) · from place (right) · dashed arrow */}
      <div className="mt-pickup__line2">
        <div className="mt-pickup__pin-col">
          <PinIcon size={16} className="mt-pickup__pin" />
          {accessKmLabel ? <span className="mt-pickup__km">{accessKmLabel}</span> : null}
          <AccessArrow />
        </div>
        <span className="mt-pickup__place">{fromPlaceLabel}</span>
      </div>

      <div className="mt-pickup__divider" aria-hidden="true" />

      {/* Cab / Auto / Bike — always visible; disabled when ride off or options open */}
      <div className="mt-pickup__modes" role="group" aria-label="Vehicle type">
        {rideModes.map((mode) => {
          const active = needRide && !showVehicleSlots && modeId === mode.id
          return (
            <button
              key={mode.id}
              type="button"
              className={`mt-pickup__mode${active ? ' is-selected' : ''}`}
              disabled={modesDisabled}
              aria-disabled={modesDisabled || undefined}
              onClick={() => onSelectMode(mode.id)}
            >
              <ModeIcon
                mode={mode.mode || mode.id}
                size={16}
                color={active ? 'var(--mt-primary)' : '#666666'}
                className="mt-pickup__mode-icon"
              />
              {mode.label}
            </button>
          )
        })}
      </div>

      {showVehicleSlots ? (
        <div
          className={`mt-provider-options${slots.filter(Boolean).length === 1 ? ' is-single' : ''}`}
          role="region"
          aria-label={`${providerId} ride options`}
        >
          {!hasSlots ? (
            <p className="mt-provider-options__empty">{providerEmptyMessage}</p>
          ) : (
            slots.filter(Boolean).map((vehicle) => {
              const active = selectedVehicleId === vehicle.id
              const { eta, fare, peak } = vehicleMetaParts(vehicle)

              return (
                <button
                  key={vehicle.id}
                  type="button"
                  aria-pressed={active}
                  className={`mt-provider-options__cell${active ? ' is-selected' : ''}${vehicle.unavailable ? ' is-unavailable' : ''}`}
                  onClick={() => onSelectVehicle(vehicle)}
                  disabled={vehicle.unavailable || undefined}
                >
                  {active ? <VehicleCheckBadge /> : null}
                  <div className="mt-provider-options__row">
                    <BrandLogo id={providerId} name={providerId} />
                    <ModeIcon
                      mode={vehicle.mode}
                      size={16}
                      className="mt-provider-options__mode-icon"
                    />
                  </div>
                  <VehicleSlotMeta label={vehicle.label} eta={eta} fare={fare} peak={peak} />
                </button>
              )
            })
          )}
        </div>
      ) : (
        <div className="mt-pickup__providers" role="list" aria-label="Ride providers">
          {LAST_MILE_PROVIDERS.map((provider) => {
            const modeBlocked = isProviderDisabledForMode(provider.id, modeId)
            const disabled = controlsDisabled || modeBlocked
            const active = needRide && providerId === provider.id
            return (
              <button
                key={provider.id}
                type="button"
                role="listitem"
                disabled={disabled}
                aria-disabled={disabled || undefined}
                title={
                  controlsDisabled
                    ? 'Enable “Need ride from” to choose a provider'
                    : providerDisabledReason(provider.id, modeId)
                }
                className={`mt-pickup__provider${active ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
                onClick={() => onSelectProvider(provider.id)}
              >
                <BrandLogo id={provider.id} name={provider.name} />
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
  trip,
  lastMile,
  needRide,
  modeId,
  slots,
  slotStatus,
  slotError,
  selectedVehicleId,
  showProviders,
  onlineFareInr,
  cashFareDisplay,
  cashRideLabel,
  confirmLoading,
  confirmError,
  fareSelections,
  collapsedFareSegments,
  onToggleFarePanel,
  onSelectFare,
  onBack,
  onConfirm,
  onToggleNeedRide,
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
          <PickupServiceCard
            journey={journey}
            trip={trip}
            needRide={needRide}
            modeId={modeId}
            providerId={lastMile.providerId}
            selectedVehicleId={selectedVehicleId}
            slots={slots}
            status={slotStatus}
            error={slotError}
            showProviders={showProviders}
            onToggleNeedRide={onToggleNeedRide}
            onSelectMode={onSelectMode}
            onSelectVehicle={onSelectVehicle}
            onSelectProvider={onSelectProvider}
            onCheckOthers={onCheckOthers}
          />

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
        </div>
      </div>

      <div className="mt-details-page__panel">
        <div className="mt-pay-stack">
          {cashFareDisplay ? (
            <div className="mt-pay mt-pay--cash">
              <CashBillIcon size={28} />
              <span>Cash{cashRideLabel ? ` · ${cashRideLabel}` : ''}</span>
              <strong>{cashFareDisplay}</strong>
            </div>
          ) : null}
          <div className="mt-pay mt-pay--online">
            <OnlinePayIcon size={28} />
            <span>Online</span>
            <strong>₹{onlineFareInr}</strong>
            <ChevronIcon size={18} className="mt-pay__chevron" />
          </div>
        </div>
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
  const [needRide, setNeedRide] = useState(() =>
    Boolean(initialLastMile.needRide || initialLastMile.providerId),
  )
  const [showProviders, setShowProviders] = useState(
    () => !initialLastMile.providerId || !initialLastMile.needRide,
  )
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
    setNeedRide(Boolean(initialLastMile.needRide || initialLastMile.providerId))
    setShowProviders(!initialLastMile.providerId || !initialLastMile.needRide)
  }, [
    initialLastMile.providerId,
    initialLastMile.vehicleId,
    initialLastMile.modeId,
    initialLastMile.needRide,
    journey?.id,
  ])

  useEffect(() => {
    if (!needRide || providerId !== 'refex') {
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
  }, [needRide, providerId, journey, trip])

  useEffect(() => {
    if (!needRide || providerId !== 'ola' || !isProviderEnabled('ola')) {
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
  }, [needRide, providerId, journey, trip])

  const liveVehicles =
    providerId === 'refex' ? refexVehicles : providerId === 'ola' ? olaVehicles : undefined

  const slots = useMemo(() => {
    if (!needRide || !providerId) return []
    return summarizeProviderModes(providerId, liveVehicles)
  }, [needRide, providerId, liveVehicles])

  const selectedVehicle = useMemo(
    () => (needRide ? slots.find((vehicle) => vehicle?.id === selectedVehicleId) || null : null),
    [needRide, slots, selectedVehicleId],
  )

  const lastMile = useMemo(
    () =>
      buildLastMilePayload(Number(id), {
        providerId: needRide ? providerId : null,
        vehicle: selectedVehicle,
        needRide,
        modeId,
      }),
    [id, needRide, providerId, selectedVehicle, modeId],
  )

  const onlineFareInr = useMemo(() => {
    const transit =
      Number(journeyWithFares?.payment?.amountInr) ||
      Number(journeyWithFares?.totalFareInr) ||
      0
    const ride = onlineFareInrFromVehicle(selectedVehicle)
    return Math.round(transit + ride)
  }, [journeyWithFares, selectedVehicle])

  const cashFareDisplay = useMemo(() => {
    if (!selectedVehicle || !isPayAtPickupVehicle(selectedVehicle)) return null
    return formatVehicleFare(selectedVehicle) || null
  }, [selectedVehicle])

  const cashRideLabel = useMemo(() => {
    if (!selectedVehicle || !isPayAtPickupVehicle(selectedVehicle)) return null
    return (
      selectedVehicle.modeLabel ||
      getLastMileMode(selectedVehicle.mode)?.label ||
      selectedVehicle.label ||
      selectedVehicle.providerId ||
      'Ride'
    )
  }, [selectedVehicle])

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

  function syncSelection(nextProviderId, nextVehicle, nextModeId, rideOn = needRide) {
    const payload = buildLastMilePayload(journey.id, {
      providerId: rideOn ? nextProviderId : null,
      vehicle: rideOn ? nextVehicle : null,
      needRide: rideOn,
      modeId: rideOn ? nextModeId || nextVehicle?.mode || modeId : null,
    })
    setLastMileSelection(payload)

    const next = new URLSearchParams({ id: String(journey.id) })
    if (payload.providerId) next.set('provider', payload.providerId)
    if (payload.modeId) next.set('mode', payload.modeId)
    if (payload.vehicleId) next.set('vehicle', payload.vehicleId)
    setParams(next, { replace: true })
  }

  function handleSelectVehicle(vehicle) {
    const nextId = selectedVehicleId === vehicle.id ? null : vehicle.id
    const nextVehicle = nextId ? vehicle : null
    setSelectedVehicleId(nextId)
    if (nextVehicle?.mode) setModeId(nextVehicle.mode)
    syncSelection(providerId, nextVehicle, nextVehicle?.mode || modeId, true)
  }

  function handleToggleNeedRide(event) {
    const checked = event.target.checked
    setNeedRide(checked)
    if (!checked) {
      // Keep filters/aggregators visible but reset any selection.
      setProviderId(null)
      setSelectedVehicleId(null)
      setShowProviders(true)
      syncSelection(null, null, modeId, false)
      return
    }
    setShowProviders(true)
    syncSelection(null, null, modeId, true)
  }

  function handleCheckOthers() {
    setShowProviders(true)
  }

  function handleSelectMode(nextModeId) {
    if (!needRide || nextModeId === modeId) return
    setModeId(nextModeId)
    if (providerId && isProviderDisabledForMode(providerId, nextModeId)) {
      setProviderId(null)
      setSelectedVehicleId(null)
      setShowProviders(true)
      syncSelection(null, null, nextModeId, true)
      return
    }
    setSelectedVehicleId(null)
    syncSelection(providerId, null, nextModeId, true)
  }

  function handleSelectProvider(nextProviderId) {
    if (!needRide) return
    if (!isProviderEnabled(nextProviderId) || isProviderDisabledForMode(nextProviderId, modeId)) {
      return
    }
    setProviderId(nextProviderId)
    setSelectedVehicleId(null)
    setShowProviders(false)
    syncSelection(nextProviderId, null, modeId, true)
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
      trip={trip}
      lastMile={lastMile}
      needRide={needRide}
      modeId={modeId}
      slots={slots}
      slotStatus={slotStatus}
      slotError={slotError}
      selectedVehicleId={selectedVehicleId}
      showProviders={showProviders}
      onlineFareInr={onlineFareInr}
      cashFareDisplay={cashFareDisplay}
      cashRideLabel={cashRideLabel}
      confirmLoading={confirmLoading}
      confirmError={confirmError}
      fareSelections={fareSelections}
      collapsedFareSegments={collapsedFareSegments}
      onToggleFarePanel={handleToggleFarePanel}
      onSelectFare={handleSelectFare}
      onBack={backToJourney}
      onConfirm={handleConfirm}
      onToggleNeedRide={handleToggleNeedRide}
      onCheckOthers={handleCheckOthers}
      onSelectMode={handleSelectMode}
      onSelectProvider={handleSelectProvider}
      onSelectVehicle={handleSelectVehicle}
    />
  )
}
