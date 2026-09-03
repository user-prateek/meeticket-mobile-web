import { useEffect, useMemo, useState } from 'react'
import { useAtomValue } from 'jotai'
import { getOlaRideEstimateForJourneyCached } from '../../api/ola'
import { searchRefexForJourney } from '../../api/refex'
import { BusGlyph, MetroGlyph, ModeIcon, PinIcon } from '../../components/icons'
import { FareClassPanel } from '../../components/FareClassPanel'
import {
  LAST_MILE_MODE_DEFAULT,
  formatVehicleEta,
  formatVehicleFare,
  getProviderCardSlots,
  isProviderDisabledForMode,
  isProviderEnabled,
  providerDisabledReason,
} from '../../constants/lastMile'
import { metroLineFromRouteId } from '../../constants/metroLines'
import { formatMetroStationName } from '../../api/journey'
import {
  applyFareSelections,
  applyFareSelectionsToJourney,
  buildInitialFareSelections,
  formatSegmentFareRange,
  cheapestFareOptionId,
} from '../../lib/fareClasses'
import { tripAtom } from '../../store/journey'
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

function CapsuleGlyph({ mode, className }) {
  if (mode === 'bus') return <BusGlyph size={13} className={className} />
  return <MetroGlyph size={13} className={className} />
}

function CompactHeader({ segment }) {
  if (!segment) return null

  const edge = 'start'
  const hasFareOptions = segment.mode === 'bus' && segment.fareOptions?.length > 1

  return (
    <div className="mt-compact">
      <ModeCapsule segment={segment} edge={edge} />
      {hasFareOptions ? (
        <TransitMeta
          segment={segment}
          edge={edge}
          hasFareOptions={hasFareOptions}
          expanded={false}
          onToggle={() => {}}
        />
      ) : (
        <p className={`mt-capsule__meta is-${segment.mode} is-edge-start`}>
          <span className="mt-capsule__meta-text">
            {segment.durationMin} Min{formatMetaFareSuffix(segment)}
          </span>
        </p>
      )}
    </div>
  )
}

/** Outer edge of card: `start` = left, `end` = right. */
function getTransitEdge(segments, segmentId) {
  const transit = segments.filter((segment) => segment.mode === 'metro' || segment.mode === 'bus')
  if (!transit.length) return 'start'
  if (transit.length === 1) return 'start'
  const index = transit.findIndex((segment) => segment.id === segmentId)
  if (index <= 0) return 'start'
  if (index >= transit.length - 1) return 'end'
  return 'center'
}

function getItemLayout(segment, segments) {
  if (segment.mode === 'walk' || segment.mode === 'interchange') return 'center'
  return getTransitEdge(segments, segment.id)
}

function formatMetaFareSuffix(segment) {
  if (segment.mode === 'bus') {
    const range = formatSegmentFareRange(segment)
    return range ? `, ${range}` : ''
  }
  return segment.fareInr != null ? `, ₹${segment.fareInr}` : ''
}

function ModeCapsule({ segment, edge = 'start' }) {
  if (segment.mode === 'walk') {
    return (
      <div className="mt-walk-badge">
        <ModeIcon mode="walk" size={18} className="mt-walk-badge__icon" />
      </div>
    )
  }

  const icon = <CapsuleGlyph mode={segment.mode} className="mt-capsule__icon" />
  const iconFirst = edge !== 'end'
  return (
    <div className={`mt-capsule is-${segment.mode}`}>
      {iconFirst ? icon : null}
      <span className="mt-capsule__label">{segment.title}</span>
      {!iconFirst ? icon : null}
    </div>
  )
}

function TransitMeta({
  segment,
  edge,
  hasFareOptions,
  expanded,
  onToggle,
}) {
  const fareSuffix = formatMetaFareSuffix(segment)
  const durationFare = (
    <span className="mt-capsule__meta-text">
      {segment.durationMin} Min{fareSuffix}
    </span>
  )
  const edgeClass = edge === 'end' ? 'is-edge-end' : 'is-edge-start'
  const isBus = segment.mode === 'bus'

  const toggle =
    isBus && hasFareOptions ? (
      <button
        type="button"
        className={`mt-fare-toggle is-bus${expanded ? ' is-open' : ''}`}
        aria-expanded={expanded}
        aria-label={expanded ? 'Hide fare classes' : 'Show fare classes'}
        onClick={(event) => {
          event.stopPropagation()
          onToggle?.()
        }}
      >
        {expanded ? '−' : '+'}
      </button>
    ) : null

  if (isBus) {
    return (
      <p className={`mt-capsule__meta is-bus ${edgeClass}`}>
        {edge === 'end' ? (
          <>
            {durationFare}
            {toggle}
          </>
        ) : (
          <>
            {toggle}
            {durationFare}
          </>
        )}
      </p>
    )
  }

  return <p className={`mt-capsule__meta is-metro ${edgeClass}`}>{durationFare}</p>
}

function Timeline({
  segments,
  fareSelections,
  expandedSegmentId,
  onToggleExpand,
  onSelectFare,
}) {
  const displaySegments = applyFareSelections(segments, fareSelections)
  const expandedSegment = displaySegments.find((segment) => segment.id === expandedSegmentId)

  return (
    <div className="mt-transit-fare">
      <div className="mt-timeline">
        {displaySegments.map((segment, index) => {
          const isInterchange = segment.mode === 'interchange'
          const isWalk = segment.mode === 'walk'
          const edge = isWalk || isInterchange ? 'center' : getTransitEdge(displaySegments, segment.id)
          const itemLayout = getItemLayout(segment, displaySegments)
          const hasFareOptions =
            segment.mode === 'bus' && segment.fareOptions?.length > 1
          const expanded = expandedSegmentId === segment.id

          return (
            <div key={segment.id} className={`mt-timeline__item is-layout-${itemLayout}`}>
              {index > 0 ? <div className="mt-timeline__rail" aria-hidden="true" /> : null}
              <div
                className={`mt-timeline__step ${MODE_CLASS[segment.mode] || ''} is-align-${edge}`}
              >
                {isInterchange ? (
                  <>
                    <ModeIcon mode="interchange" size={28} className="mt-timeline__interchange" />
                    <p className="mt-timeline__label">
                      {segment.subtitle ?? segment.title ?? 'Interchange'}
                    </p>
                  </>
                ) : isWalk ? (
                  <>
                    <ModeCapsule segment={segment} edge={edge} />
                    <p className="mt-walk__meta">{segment.durationMin} Min</p>
                  </>
                ) : (
                  <>
                    <ModeCapsule segment={segment} edge={edge} />
                    <TransitMeta
                      segment={segment}
                      edge={edge}
                      hasFareOptions={hasFareOptions}
                      expanded={expanded}
                      onToggle={() =>
                        onToggleExpand?.(expanded ? null : segment.id)
                      }
                    />
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {expandedSegment?.mode === 'bus' && expandedSegment.fareOptions?.length > 1 ? (
        <FareClassPanel
          className="mt-transit-fare__panel"
          segmentId={expandedSegment.id}
          options={expandedSegment.fareOptions}
          selectedId={
            fareSelections[expandedSegment.id] ||
            cheapestFareOptionId(expandedSegment.fareOptions)
          }
          side={getTransitEdge(displaySegments, expandedSegment.id)}
          ariaLabel={`${expandedSegment.title} fare classes`}
          onClick={(event) => event.stopPropagation()}
          onSelect={(optionId) => onSelectFare?.(expandedSegment.id, optionId)}
        />
      ) : null}
    </div>
  )
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

/** Card for one journey option (metro/bus hops only; access/egress are last-mile). */
export function RouteCard({
  option,
  selected = false,
  fareSelections,
  onFareSelectionsChange,
  onSelect,
  onOpenDetails,
  onLastMileChange,
}) {
  const [lastMile, setLastMile] = useState(LAST_MILE_MODE_DEFAULT)
  const [providerExpanded, setProviderExpanded] = useState(false)
  const [selectedProviderId, setSelectedProviderId] = useState(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState(null)
  const [refexVehicles, setRefexVehicles] = useState([])
  const [olaVehicles, setOlaVehicles] = useState([])
  const [liveStatus, setLiveStatus] = useState('idle')
  const [liveError, setLiveError] = useState('')
  const [expandedFareSegmentId, setExpandedFareSegmentId] = useState(null)
  const trip = useAtomValue(tripAtom)

  const timeline = option.cardSegments?.length ? option.cardSegments : option.segments
  const resolvedFareSelections = useMemo(
    () => fareSelections ?? buildInitialFareSelections(timeline),
    [fareSelections, timeline],
  )
  const displayOption = useMemo(
    () => applyFareSelectionsToJourney(option, resolvedFareSelections),
    [option, resolvedFareSelections],
  )
  const displayTimeline = displayOption.cardSegments?.length
    ? displayOption.cardSegments
    : displayOption.segments
  const transitOnly = timeline.filter((seg) => seg.mode !== 'interchange')
  const compact = transitOnly.length === 1 && timeline.length === 1
  const singleHasFareOptions = compact && displayTimeline[0]?.fareOptions?.length > 1
  const pickupLabel = option.access?.fromLabel || 'Current location'
  const providers = option.lastMileProviders ?? []

  const liveVehicles =
    selectedProviderId === 'refex'
      ? refexVehicles
      : selectedProviderId === 'ola'
        ? olaVehicles
        : undefined

  const providerSlots = useMemo(() => {
    if (!providerExpanded || !selectedProviderId) return []
    return getProviderCardSlots(selectedProviderId, liveVehicles)
  }, [providerExpanded, selectedProviderId, liveVehicles])

  const hasProviderOptions = providerSlots.some(Boolean)

  useEffect(() => {
    if (!providerExpanded || selectedProviderId !== 'refex') {
      return undefined
    }

    const controller = new AbortController()
    setLiveStatus('loading')
    setLiveError('')

    searchRefexForJourney(
      { journey: option, trip, serviceId: 'pickup' },
      { signal: controller.signal },
    )
      .then((result) => {
        setRefexVehicles(result.vehicles)
        setLiveStatus('ready')
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setRefexVehicles([])
        setLiveStatus('error')
        setLiveError(error.message || 'Refex search failed')
      })

    return () => controller.abort()
  }, [providerExpanded, selectedProviderId, option.id, trip])

  useEffect(() => {
    if (!providerExpanded || selectedProviderId !== 'ola' || !isProviderEnabled('ola')) {
      return undefined
    }

    const controller = new AbortController()
    setOlaVehicles([])
    setLiveStatus('loading')
    setLiveError('')

    getOlaRideEstimateForJourneyCached({
      journey: option,
      trip,
      serviceId: 'pickup',
      signal: controller.signal,
      refresh: true,
    })
      .then((result) => {
        if (controller.signal.aborted) return
        setOlaVehicles(result.vehicles)
        setLiveStatus('ready')
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setOlaVehicles([])
        setLiveStatus('error')
        setLiveError(error.message || 'Could not load Ola ride estimates.')
      })

    return () => controller.abort()
  }, [providerExpanded, selectedProviderId, option.id, trip])

  // Keep selection only if the slot still exists — do not auto-pick a vehicle.
  useEffect(() => {
    if (!providerExpanded || !hasProviderOptions) {
      setSelectedVehicleId(null)
      return
    }
    setSelectedVehicleId((current) =>
      current && providerSlots.some((vehicle) => vehicle?.id === current) ? current : null,
    )
  }, [providerExpanded, hasProviderOptions, providerSlots])

  // Collapse last-mile provider view when another journey card is selected.
  useEffect(() => {
    if (selected) return
    setProviderExpanded(false)
    setSelectedProviderId(null)
    setSelectedVehicleId(null)
  }, [selected])

  const selectedVehicle = useMemo(
    () => providerSlots.find((vehicle) => vehicle?.id === selectedVehicleId) || null,
    [providerSlots, selectedVehicleId],
  )

  useEffect(() => {
    if (!selected) return
    onLastMileChange?.({
      journeyId: option.id,
      providerId: selectedProviderId,
      modeId: selectedVehicle?.mode || lastMile,
      vehicleId: selectedVehicleId,
      vehicle: selectedVehicle,
      providerExpanded,
    })
  }, [
    selected,
    option.id,
    selectedProviderId,
    selectedVehicleId,
    selectedVehicle,
    lastMile,
    providerExpanded,
    onLastMileChange,
  ])

  function selectFareClass(segmentId, optionId) {
    onFareSelectionsChange?.({
      ...resolvedFareSelections,
      [segmentId]: optionId,
    })
  }

  function selectCard() {
    onSelect?.(option)
  }

  function selectLastMile(event, id) {
    event.stopPropagation()
    selectCard()
    setLastMile(id)
    if (providerExpanded && isProviderDisabledForMode(selectedProviderId, id)) {
      setProviderExpanded(false)
      setSelectedProviderId(null)
      setSelectedVehicleId(null)
    }
  }

  function selectProvider(event, id) {
    event.stopPropagation()
    if (!isProviderEnabled(id) || isProviderDisabledForMode(id, lastMile)) return
    selectCard()
    setSelectedProviderId(id)
    setProviderExpanded(true)
    setSelectedVehicleId(null)
    setLiveStatus('idle')
    setLiveError('')
  }

  function checkOthers(event) {
    event.stopPropagation()
    selectCard()
    setProviderExpanded(false)
    setSelectedProviderId(null)
    setSelectedVehicleId(null)
  }

  function selectVehicleSlot(event, vehicleId) {
    event.stopPropagation()
    selectCard()
    // Tap again to unselect.
    setSelectedVehicleId((current) => (current === vehicleId ? null : vehicleId))
  }

  let providerEmptyMessage = 'No options for this mode.'
  if (selectedProviderId === 'refex') {
    if (lastMile !== 'cab') providerEmptyMessage = 'Refex is available for cab only.'
    else if (liveStatus === 'loading') providerEmptyMessage = 'Searching Refex…'
    else if (liveStatus === 'error') providerEmptyMessage = liveError || 'Refex search failed.'
  } else if (selectedProviderId === 'ola') {
    if (liveStatus === 'loading' || liveStatus === 'idle') {
      providerEmptyMessage = 'Getting Ola estimates…'
    } else if (liveStatus === 'error') {
      providerEmptyMessage = liveError || 'Could not load Ola estimates.'
    } else {
      providerEmptyMessage = 'No Ola rides available near this pickup.'
    }
  }

  return (
    <article
      className={`mt-card${selected ? ' is-selected' : ''}${option.notSuggested ? ' is-not-suggested' : ''}`}
      onClick={() => onSelect?.(option)}
      onDoubleClick={() => onOpenDetails?.(option)}
      aria-pressed={selected}
    >
      {option.notSuggested && option.note ? (
        <p className="mt-card__hint">{option.note}</p>
      ) : null}

      {compact && !singleHasFareOptions ? (
        <CompactHeader segment={displayTimeline[0]} />
      ) : (
        <Timeline
          segments={displayTimeline}
          fareSelections={resolvedFareSelections}
          expandedSegmentId={expandedFareSegmentId}
          onToggleExpand={setExpandedFareSegmentId}
          onSelectFare={selectFareClass}
        />
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
                  <span>{displayStationName(stop.from, stop.mode)}</span>
                  <span>{displayStationName(stop.to, stop.mode)}</span>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      <div className="mt-mile">
        <div className="mt-mile__row">
          <div className="mt-mile__origin">
          <AccessCurve />
            <PinIcon size={14} className="mt-mile__pin" />
            <div className="mt-mile__places">
              <span className="mt-mile__station">{pickupLabel}</span>
            </div>
          </div>

          {providerExpanded ? (
            <button type="button" className="mt-mile__more" onClick={checkOthers}>
              Check Others
            </button>
          ) : (
            <div className="mt-mile__modes" role="group" aria-label="First mile modes">
              {(option.lastMileOptions ?? []).map((mileOption) => (
                <button
                  key={mileOption.id}
                  type="button"
                  className={`mt-mile__mode${lastMile === mileOption.id ? ' is-selected' : ''}`}
                  onClick={(event) => selectLastMile(event, mileOption.id)}
                >
                  <ModeIcon mode={mileOption.mode} size={18} className="mt-mile__mode-icon" />
                  {mileOption.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {providerExpanded ? (
          <div
            className="mt-provider-options"
            role="region"
            aria-label={`${selectedProviderId} ride options`}
          >
            {!hasProviderOptions ? (
              <p className="mt-provider-options__empty">{providerEmptyMessage}</p>
            ) : (
              providerSlots.filter(Boolean).map((vehicle) => {
                const active = selectedVehicleId === vehicle.id
                const { eta, fare, peak } = vehicleMetaParts(vehicle)

                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    aria-pressed={active}
                    className={`mt-provider-options__cell${active ? ' is-selected' : ''}${vehicle.unavailable ? ' is-unavailable' : ''}`}
                    onClick={(event) => selectVehicleSlot(event, vehicle.id)}
                    disabled={vehicle.unavailable || undefined}
                  >
                    {active ? <VehicleCheckBadge /> : null}
                    <div className="mt-provider-options__row">
                      <BrandLogo id={selectedProviderId} name={selectedProviderId} />
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
          <div className="mt-providers" role="list" aria-label="Ride providers">
            {providers.map((provider) => {
              const disabled = isProviderDisabledForMode(provider.id, lastMile)
              return (
                <button
                  key={provider.id}
                  type="button"
                  role="listitem"
                  disabled={disabled}
                  aria-disabled={disabled || undefined}
                  title={providerDisabledReason(provider.id, lastMile)}
                  className={`mt-providers__cell mt-providers__cell--${provider.id}${disabled ? ' is-disabled' : ''}`}
                  onClick={(event) => selectProvider(event, provider.id)}
                >
                  <BrandLogo id={provider.id} name={provider.name} />
                </button>
              )
            })}
          </div>
        )}
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
          <strong className="is-fare">₹{displayOption.totalFareInr}</strong>
        </div>
      </div>
    </article>
  )
}
