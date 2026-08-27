import { useEffect, useMemo, useState } from 'react'
import { searchRefexHardcodedTestCached } from '../../api/refex'
import { BusGlyph, MetroGlyph, ModeIcon, PinIcon } from '../../components/icons'
import {
  CARD_MODE_ORDER,
  LAST_MILE_MODE_DEFAULT,
  formatFare,
  getProviderCardSlots,
  isProviderDisabledForMode,
} from '../../constants/lastMile'
import { metroLineFromRouteId } from '../../constants/metroLines'
import { formatMetroStationName } from '../../api/journey'
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
  const eta = vehicle.etaMin != null ? `${vehicle.etaMin} Min` : null
  const fare = vehicle.fareInr != null ? formatFare(vehicle.fareInr) : null
  return { eta, fare }
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

  const fare = segment.fareInr != null ? `, ₹${segment.fareInr}` : ''

  return (
    <div className="mt-compact">
      <div className={`mt-capsule is-${segment.mode}`}>
        <CapsuleGlyph mode={segment.mode} className="mt-capsule__icon" />
        <span className="mt-capsule__label">{segment.title}</span>
      </div>
      <p className={`mt-capsule__meta is-${segment.mode}`}>
        {segment.durationMin} Min{fare}
      </p>
    </div>
  )
}

function ModeCapsule({ segment, iconSide = 'left' }) {
  const icon = <CapsuleGlyph mode={segment.mode} className="mt-capsule__icon" />
  return (
    <div className={`mt-capsule is-${segment.mode}`}>
      {iconSide === 'left' ? icon : null}
      <span className="mt-capsule__label">{segment.title}</span>
      {iconSide === 'right' ? icon : null}
    </div>
  )
}

function Timeline({ segments }) {
  const lastIndex = segments.length - 1

  return (
    <div className="mt-timeline">
      {segments.map((segment, index) => {
        const isInterchange = segment.mode === 'interchange'
        const iconSide = index === lastIndex && index > 0 ? 'right' : 'left'
        const farePart =
          !isInterchange && segment.fareInr != null ? `, ₹${segment.fareInr}` : ''

        return (
          <div key={segment.id} className="mt-timeline__item">
            {index > 0 ? <div className="mt-timeline__rail" aria-hidden="true" /> : null}
            <div className={`mt-timeline__step ${MODE_CLASS[segment.mode] || ''}`}>
              {isInterchange ? (
                <>
                  <ModeIcon mode="interchange" size={28} className="mt-timeline__interchange" />
                  <p className="mt-timeline__label">
                    {segment.subtitle ?? segment.title ?? 'Interchange'}
                  </p>
                </>
              ) : (
                <>
                  <ModeCapsule segment={segment} iconSide={iconSide} />
                  <p className={`mt-capsule__meta ${MODE_CLASS[segment.mode] || ''}`}>
                    {segment.durationMin} Min{farePart}
                  </p>
                </>
              )}
            </div>
          </div>
        )
      })}
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
export function RouteCard({ option, selected = false, onSelect, onOpenDetails, onLastMileChange }) {
  const [lastMile, setLastMile] = useState(LAST_MILE_MODE_DEFAULT)
  const [providerExpanded, setProviderExpanded] = useState(false)
  const [selectedProviderId, setSelectedProviderId] = useState(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState(null)
  const [refexVehicles, setRefexVehicles] = useState([])
  const [refexStatus, setRefexStatus] = useState('idle')
  const [refexError, setRefexError] = useState('')

  const timeline = option.cardSegments?.length ? option.cardSegments : option.segments
  const transitOnly = timeline.filter((seg) => seg.mode !== 'interchange')
  const compact = transitOnly.length === 1 && timeline.length === 1
  const boardingStationRaw =
    option.access?.toLabel || option.originStation || option.stops?.[0]?.from || 'Station'
  const boardingStationLabel = displayStationName(boardingStationRaw, option.stops?.[0]?.mode)
  const pickupLabel = option.access?.fromLabel || 'Current location'
  const providers = option.lastMileProviders ?? []

  const providerSlots = useMemo(() => {
    if (!providerExpanded || !selectedProviderId) return []
    return getProviderCardSlots(selectedProviderId, refexVehicles)
  }, [providerExpanded, selectedProviderId, refexVehicles])

  const hasProviderOptions = providerSlots.some(Boolean)

  useEffect(() => {
    if (!providerExpanded || selectedProviderId !== 'refex') {
      setRefexStatus('idle')
      setRefexError('')
      return undefined
    }

    const controller = new AbortController()
    setRefexStatus('loading')
    setRefexError('')

    searchRefexHardcodedTestCached({ signal: controller.signal })
      .then((result) => {
        setRefexVehicles(result.vehicles)
        setRefexStatus('ready')
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setRefexVehicles([])
        setRefexStatus('error')
        setRefexError(error.message || 'Refex search failed')
      })

    return () => controller.abort()
  }, [providerExpanded, selectedProviderId])

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
    if (isProviderDisabledForMode(id, lastMile)) return
    selectCard()
    setSelectedProviderId(id)
    setProviderExpanded(true)
    setSelectedVehicleId(null)
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
    else if (refexStatus === 'loading') providerEmptyMessage = 'Searching Refex…'
    else if (refexStatus === 'error') providerEmptyMessage = refexError || 'Refex search failed.'
  }

  return (
    <article
      className={`mt-card${selected ? ' is-selected' : ''}${option.notSuggested ? ' is-not-suggested' : ''}`}
      onClick={() => onSelect?.(option)}
      onDoubleClick={() => onOpenDetails?.(option)}
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
              providerSlots.map((vehicle, index) => {
                if (!vehicle) {
                  return (
                    <div
                      key={CARD_MODE_ORDER[index]}
                      className="mt-provider-options__cell is-empty"
                      aria-hidden="true"
                    />
                  )
                }

                const active = selectedVehicleId === vehicle.id
                const { eta, fare } = vehicleMetaParts(vehicle)

                return (
                  <button
                    key={vehicle.id}
                    type="button"
                    aria-pressed={active}
                    className={`mt-provider-options__cell${active ? ' is-selected' : ''}`}
                    onClick={(event) => selectVehicleSlot(event, vehicle.id)}
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
                    <span className="mt-provider-options__meta">
                      {eta ? <span className="mt-provider-options__eta">{eta}</span> : null}
                      {eta && fare ? (
                        <span className="mt-provider-options__dot" aria-hidden="true">
                          {' '}
                          •{' '}
                        </span>
                      ) : null}
                      {fare ? <span className="mt-provider-options__fare">{fare}</span> : null}
                    </span>
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
                  title={disabled ? 'Refex is available for cab only' : undefined}
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
          <strong className="is-fare">₹{option.totalFareInr}</strong>
        </div>
      </div>
    </article>
  )
}
