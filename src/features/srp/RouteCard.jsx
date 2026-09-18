import { useEffect, useMemo, useRef, useState } from 'react'
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
import { busRouteLabel } from '../../lib/busRoute'
import {
  applyFareSelections,
  applyFareSelectionsToJourney,
  buildInitialFareSelections,
  formatSegmentFareRange,
  cheapestFareOptionId,
} from '../../lib/fareClasses'
import { ensureOlaToken } from '../../lib/olaLink'
import { peekOlaOauthResume, takeOlaOauthResume } from '../../lib/olaOauth'
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

function srpOlaResume(optionId) {
  const resume = peekOlaOauthResume()
  if (resume?.kind !== 'srp' || String(resume.journeyId) !== String(optionId)) return null
  return resume
}

function BrandLogo({ id, name, className = '' }) {
  const src = BRAND_LOGO[id]
  if (!src) return <span className={`mt-brand mt-brand--${id}${className ? ` ${className}` : ''}`}>{name}</span>
  return (
    <img
      className={`mt-brand mt-brand--${id}${className ? ` ${className}` : ''}`}
      src={src}
      alt={name}
      draggable={false}
    />
  )
}

function displayStationName(name, mode) {
  if (mode !== 'metro') return name
  return formatMetroStationName(name)
}

function hexToRgba(hex, alpha = 0.08) {
  if (!hex) return `rgba(6, 4, 150, ${alpha})`
  const raw = String(hex).replace('#', '')
  const full =
    raw.length === 3
      ? raw
        .split('')
        .map((ch) => ch + ch)
        .join('')
      : raw
  const n = Number.parseInt(full, 16)
  if (!Number.isFinite(n)) return `rgba(6, 4, 150, ${alpha})`
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function metroLineCardTitle(routeId) {
  const line = metroLineFromRouteId(routeId)
  if (!line?.id) return 'metro'
  return `${line.id} line metro`
}

function stopCardTitle(stop) {
  if (stop.mode === 'metro') return metroLineCardTitle(stop.routeId)
  if (stop.mode === 'bus') return busRouteLabel(stop)
  return null
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

function firstTransitMode(segments = []) {
  return firstTransitHop(segments)?.mode || 'metro'
}

/** Accent for access pin/arrow + first boarding: metro line color, else bus orange / navy. */
function transitAccentHex(segment) {
  if (!segment) return null
  if (segment.mode === 'bus') return null // use CSS --mt-bus
  if (segment.mode === 'metro') {
    return (
      metroLineFromRouteId(segment.routeId || segment.routeShortName)?.hex || null
    )
  }
  return null
}

function metroSegmentLine(segment) {
  if (segment?.mode !== 'metro') return null
  return metroLineFromRouteId(segment.routeId || segment.routeShortName)
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
  const hasFareOptions = segment.mode === 'bus' && segment.fareOptions?.length > 0

  return (
    <div className="mt-compact">
      <ModeCapsule segment={segment} edge={edge} />
      {hasFareOptions ? (
        <TransitMeta
          segment={segment}
          edge={edge}
          hasFareOptions={hasFareOptions}
          expanded={false}
          onToggle={() => { }}
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

function formatMetaFareSuffix(segment, { hideMetroFare = false } = {}) {
  if (segment.mode === 'bus') {
    const range = formatSegmentFareRange(segment)
    return range ? `, ${range}` : ''
  }
  // Metro↔metro interchange: legs don't sum to journey total — show total only.
  if (segment.mode === 'metro' && hideMetroFare) return ''
  return segment.fareInr != null ? `, ₹${segment.fareInr}` : ''
}

function hasMetroInterchange(segments) {
  return segments.filter((segment) => segment.mode === 'metro').length >= 2
}

function ModeCapsule({ segment, edge = 'start' }) {
  if (segment.mode === 'walk') {
    return (
      <div className="mt-walk-badge">
        <ModeIcon mode="walk" size={18} className="mt-walk-badge__icon" />
      </div>
    )
  }

  const line = metroSegmentLine(segment)
  const capsuleStyle =
    segment.mode === 'metro' && line?.hex ? { background: line.hex } : undefined
  const icon = <CapsuleGlyph mode={segment.mode} className="mt-capsule__icon" />
  const iconFirst = edge !== 'end'
  return (
    <div className={`mt-capsule is-${segment.mode}`} style={capsuleStyle}>
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
  hideMetroFare = false,
}) {
  const fareSuffix = formatMetaFareSuffix(segment, { hideMetroFare })
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

  const line = metroSegmentLine(segment)
  const metaStyle = line?.hex ? { color: line.hex } : undefined
  return (
    <p className={`mt-capsule__meta is-metro ${edgeClass}`} style={metaStyle}>
      {durationFare}
    </p>
  )
}

function Timeline({
  segments,
  fareSelections,
  expandedSegmentId,
  onToggleExpand,
  onSelectFare,
  groupId,
  includePanel = true,
}) {
  const displaySegments = applyFareSelections(segments, fareSelections)
  const expandedSegment = displaySegments.find((segment) => segment.id === expandedSegmentId)
  const hideMetroFare = hasMetroInterchange(displaySegments)

  const panel =
    expandedSegment?.mode === 'bus' && expandedSegment.fareOptions?.length > 0 ? (
      <FareClassPanel
        className="mt-transit-fare__panel"
        groupId={groupId}
        segmentId={expandedSegment.id}
        options={expandedSegment.fareOptions}
        selectedId={
          fareSelections[expandedSegment.id] ||
          cheapestFareOptionId(expandedSegment.fareOptions) ||
          expandedSegment.fareOptions[0]?.id
        }
        side={getTransitEdge(displaySegments, expandedSegment.id)}
        ariaLabel={`${expandedSegment.title} fare classes`}
        onClick={(event) => event.stopPropagation()}
        onSelect={(optionId) => onSelectFare?.(expandedSegment.id, optionId)}
      />
    ) : null

  return (
    <>
      <div className="mt-timeline">
        {displaySegments.map((segment, index) => {
          const isInterchange = segment.mode === 'interchange'
          const isWalk = segment.mode === 'walk'
          const edge = isWalk || isInterchange ? 'center' : getTransitEdge(displaySegments, segment.id)
          const itemLayout = getItemLayout(segment, displaySegments)
          const hasFareOptions =
            segment.mode === 'bus' && segment.fareOptions?.length > 0
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
                      hideMetroFare={hideMetroFare}
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
      {includePanel ? panel : null}
    </>
  )
}

function TimelineFarePanel({
  segments,
  fareSelections,
  expandedSegmentId,
  onSelectFare,
  groupId,
}) {
  const displaySegments = applyFareSelections(segments, fareSelections)
  const expandedSegment = displaySegments.find((segment) => segment.id === expandedSegmentId)
  if (!(expandedSegment?.mode === 'bus' && expandedSegment.fareOptions?.length > 0)) {
    return null
  }

  return (
    <FareClassPanel
      className="mt-transit-fare__panel"
      groupId={groupId}
      segmentId={expandedSegment.id}
      options={expandedSegment.fareOptions}
      selectedId={
        fareSelections[expandedSegment.id] ||
        cheapestFareOptionId(expandedSegment.fareOptions) ||
        expandedSegment.fareOptions[0]?.id
      }
      side={getTransitEdge(displaySegments, expandedSegment.id)}
      ariaLabel={`${expandedSegment.title} fare classes`}
      onClick={(event) => event.stopPropagation()}
      onSelect={(optionId) => onSelectFare?.(expandedSegment.id, optionId)}
    />
  )
}

/** Fixed decorative access arrows (place → first boarding). Absolute — no layout space. */
function AccessArrow({ size = 'small' }) {
  if (size === 'big') {
    return (
      <svg
        className="mt-card__access-arrow is-big"
        width="20"
        height="51"
        viewBox="0 0 20 51"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M7.64209 0.27402C1.13329 10.2123 -6.80744 32.8603 13.5 43.9463"
          stroke="currentColor"
          strokeDasharray="2 2"
        />
        <path
          d="M17.311 45.9352L15.534 39.0342L10.41 47.7122L17.311 45.9352Z"
          fill="currentColor"
        />
      </svg>
    )
  }

  return (
    <svg
      className="mt-card__access-arrow is-small"
      width="13"
      height="25"
      viewBox="0 0 13 25"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4.34574 0.325195C0.841003 4.42135 -3.43477 13.756 7.5 18.3252"
        stroke="currentColor"
        strokeDasharray="2 2"
      />
      <path
        d="M10.311 19.9821L8.53394 13.0811L3.40999 21.7591L10.311 19.9821Z"
        fill="currentColor"
      />
    </svg>
  )
}

/** Cab page / detail “check others” — reserved for provider strip overflow. */
function ProvidersNextIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path
        d="M3.2 1.5 6.8 5 3.2 8.5"
        stroke="#fff"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
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
  onLastMileChange,
}) {
  const resumeHere = srpOlaResume(option.id)
  const [lastMile, setLastMile] = useState(
    () => resumeHere?.lastMile || LAST_MILE_MODE_DEFAULT,
  )
  const [needRide, setNeedRide] = useState(() => Boolean(resumeHere))
  const [providerExpanded, setProviderExpanded] = useState(() => Boolean(resumeHere))
  const [selectedProviderId, setSelectedProviderId] = useState(() => (resumeHere ? 'ola' : null))
  const [selectedVehicleId, setSelectedVehicleId] = useState(null)
  const [refexVehicles, setRefexVehicles] = useState([])
  const [olaVehicles, setOlaVehicles] = useState([])
  const [liveStatus, setLiveStatus] = useState('idle')
  const [liveError, setLiveError] = useState('')
  const [expandedFareSegmentId, setExpandedFareSegmentId] = useState(null)
  const olaLinkingRef = useRef(false)
  const restoredFromOauthRef = useRef(Boolean(resumeHere))
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
  const singleHasFareOptions = compact && displayTimeline[0]?.fareOptions?.length > 0
  const fromPlaceLabel = trip?.fromPlace || option.access?.fromLabel || 'Current location'
  const accessKmLabel = formatAccessKm(option.access?.distanceM)
  const firstHop = firstTransitHop(displayTimeline)
  const rideTarget = firstHop?.mode === 'bus' ? 'bus station' : 'metro station'
  const accessLineHex = transitAccentHex(firstHop)
  const accessAccent =
    firstHop?.mode === 'bus' ? 'var(--mt-bus)' : accessLineHex || 'var(--mt-navy)'
  const providers = option.lastMileProviders ?? []
  const rideModes = (option.lastMileOptions ?? []).filter(
    (item) => item.id === 'cab' || item.id === 'auto',
  )

  // Fare shoutbox open by default for the first bus leg with fare_options.
  useEffect(() => {
    const segments = option.cardSegments?.length ? option.cardSegments : option.segments || []
    const firstBusWithFares = segments.find(
      (segment) => segment.mode === 'bus' && segment.fareOptions?.length > 0,
    )
    setExpandedFareSegmentId(firstBusWithFares?.id ?? null)
  }, [option.id])

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
    if (selected) {
      if (restoredFromOauthRef.current) {
        takeOlaOauthResume()
        restoredFromOauthRef.current = false
      }
      return
    }
    if (restoredFromOauthRef.current) return
    setNeedRide(false)
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
    if (!needRide) {
      onLastMileChange?.({
        journeyId: option.id,
        needRide: false,
        providerId: null,
        modeId: null,
        vehicleId: null,
        vehicle: null,
        providerExpanded: false,
      })
      return
    }
    onLastMileChange?.({
      journeyId: option.id,
      needRide: true,
      providerId: selectedProviderId,
      modeId: selectedVehicle?.mode || lastMile,
      vehicleId: selectedVehicleId,
      vehicle: selectedVehicle,
      providerExpanded,
    })
  }, [
    selected,
    needRide,
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

  function toggleNeedRide(event) {
    event.stopPropagation()
    selectCard()
    setNeedRide((current) => {
      const next = !current
      if (!next) {
        setProviderExpanded(false)
        setSelectedProviderId(null)
        setSelectedVehicleId(null)
      }
      return next
    })
  }

  function selectLastMile(event, id) {
    event.stopPropagation()
    selectCard()
    setNeedRide(true)
    setLastMile(id)
    if (providerExpanded && isProviderDisabledForMode(selectedProviderId, id)) {
      setProviderExpanded(false)
      setSelectedProviderId(null)
      setSelectedVehicleId(null)
    }
  }

  async function selectProvider(event, id) {
    event.stopPropagation()
    if (!needRide) setNeedRide(true)
    if (!isProviderEnabled(id) || isProviderDisabledForMode(id, lastMile)) return
    if (id === 'ola') {
      if (olaLinkingRef.current) return
      olaLinkingRef.current = true
      try {
        const result = await ensureOlaToken({
          resume: {
            kind: 'srp',
            journeyId: option.id,
            providerId: 'ola',
            lastMile,
            needRide: true,
          },
        })
        if (result.source === 'oauth') return
      } finally {
        olaLinkingRef.current = false
      }
    }
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
    const next = providers.find(
      (provider) =>
        isProviderEnabled(provider.id) && !isProviderDisabledForMode(provider.id, lastMile),
    )
    if (!next) return
    setSelectedProviderId(next.id)
    setProviderExpanded(true)
    setSelectedVehicleId(null)
    setLiveStatus('idle')
    setLiveError('')
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
    <div className={`mt-route${option.notSuggested ? ' is-not-suggested' : ''}`}>
      <article
        className={`mt-card${selected ? ' is-selected' : ''}`}
        onClick={() => onSelect?.(option)}
        aria-pressed={selected}
      >
        <div className="mt-card__body">
          {option.notSuggested && option.note ? (
            <p className="mt-card__hint">{option.note}</p>
          ) : null}

          <div
            className={`mt-card__access${firstHop?.mode === 'bus' ? ' is-bus' : ' is-metro'}${needRide ? ' is-need-ride' : ''}`}
            style={{ '--mt-access-accent': accessAccent }}
          >
            <div className="mt-card__from">
              <PinIcon size={16} className="mt-card__from-pin" />
              <span className="mt-card__from-label">{fromPlaceLabel}</span>
            </div>

            <div className="mt-card__access-path">
              <AccessArrow size={needRide ? 'big' : 'small'} />

              <div className="mt-card__ride-row">
                {accessKmLabel ? (
                  <span className="mt-card__access-km">{accessKmLabel}</span>
                ) : (
                  <span className="mt-card__access-km is-empty" aria-hidden="true" />
                )}
                <div className={`mt-card__ride-check-container${needRide ? ' checked' : ''}`}>
                  <div className="mt-card__ride-modes" role="group" aria-label="First mile modes">
                    <label
                      className="mt-card__ride-check"
                      onClick={(event) => event.stopPropagation()}
                    >
                      <span className='mt-card__ride-check-input'> 
                      <input
                        type="checkbox"
                        checked={needRide}
                        onChange={toggleNeedRide}
                      />
                      </span>
                      <span>need ride to {rideTarget}</span>
                    </label>
                    <div>
                      {rideModes.map((mileOption) => (
                        <button
                          key={mileOption.id}
                          type="button"
                          className={`mt-card__ride-mode${needRide && lastMile === mileOption.id ? ' is-selected' : ''}`}
                          onClick={(event) => selectLastMile(event, mileOption.id)}
                        >
                          <ModeIcon
                            mode={mileOption.mode}
                            size={16}
                            className="mt-card__ride-mode-icon"
                          />
                          {mileOption.label}
                        </button>
                      ))}
                    </div>
                    
                  </div>
                  {needRide ? (
                      <div className="mt-card__providers-container">
                        <div
                          className="mt-card__providers"
                          role="list"
                          aria-label="Ride providers"
                          onClick={(event) => event.stopPropagation()}
                        >
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
                                className={`mt-card__provider${selectedProviderId === provider.id ? ' is-selected' : ''}${disabled ? ' is-disabled' : ''}`}
                                onClick={(event) => selectProvider(event, provider.id)}
                              >
                                <BrandLogo
                                  id={provider.id}
                                  name={provider.name}
                                  className="mt-card__provider-logo"
                                />
                              </button>
                            )
                          })}
                          <button
                            type="button"
                            className="mt-card__providers-next"
                            aria-label="More ride options"
                            onClick={checkOthers}
                          >
                            <ProvidersNextIcon />
                          </button>
                        </div>
                      </div>
                    ) : null}
                </div>
              </div>
              {needRide && providerExpanded ? (
                <div
                  className="mt-provider-options"
                  role="region"
                  aria-label={`${selectedProviderId} ride options`}
                  onClick={(event) => event.stopPropagation()}
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
                          <VehicleSlotMeta
                            label={vehicle.label}
                            eta={eta}
                            fare={fare}
                            peak={peak}
                          />
                        </button>
                      )
                    })
                  )}
                </div>
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
                  groupId={option.id}
                  includePanel={false}
                />
              )}
            </div>

            {!(compact && !singleHasFareOptions) ? (
              <TimelineFarePanel
                segments={displayTimeline}
                fareSelections={resolvedFareSelections}
                expandedSegmentId={expandedFareSegmentId}
                onSelectFare={selectFareClass}
                groupId={option.id}
              />
            ) : null}
          </div>

          {option.stops?.length > 0 ? (
            <div className={`mt-stops${option.stops.length === 1 ? ' is-single' : ''}`}>
              {option.stops.map((stop) => {
                const line =
                  stop.mode === 'metro' ? metroLineFromRouteId(stop.routeId) : null
                const title = stopCardTitle(stop)
                const lineStyle = line ? { background: line.hex } : undefined
                const railStyle = line
                  ? { background: `color-mix(in srgb, ${line.hex} 35%, #d5dae2)` }
                  : undefined
                const cardStyle =
                  stop.mode === 'metro' && line
                    ? {
                      borderColor: line.hex,
                      background: hexToRgba(line.hex, 0.08),
                    }
                    : undefined
                const titleStyle = line
                  ? {
                    color: line.hex,
                    background: '#fff',
                  }
                  : undefined

                return (
                  <div
                    key={`${stop.from}-${stop.to}-${stop.routeId || ''}`}
                    className={`mt-stop ${stop.mode ? MODE_CLASS[stop.mode] : ''}${title ? ' has-line' : ''}`.trim()}
                    style={cardStyle}
                  >
                    {title ? (
                      <span className="mt-stop__line-title" style={titleStyle}>
                        {title}
                      </span>
                    ) : null}
                    <div className="mt-stop__inner">
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
                  </div>
                )
              })}
            </div>
          ) : null}
        </div>
      </article>

      <div className="mt-metrics" aria-label="Trip totals">
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
    </div>
  )
}
