import { useEffect, useMemo, useState } from 'react'
import olaLogo from '../../assets/brands/ola.png'
import rapidoLogo from '../../assets/brands/rapido.png'
import refexLogo from '../../assets/brands/refex.png'
import { ModeIcon, PinIcon } from '../../components/icons'
import { searchRefexForJourney } from '../../api/refex'
import { LAST_MILE_OPTIONS } from '../../constants/journey'
import {
  LAST_MILE_MODE_DEFAULT,
  LAST_MILE_PROVIDERS,
  formatVehicleEta,
  formatVehicleFare,
  getProviderCardSlots,
  isProviderDisabledForMode,
  isProviderEnabled,
  providerDisabledReason,
} from '../../constants/lastMile'
import '../srp/RouteCard.css'
import './DropServiceSheet.css'

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

function vehicleMetaParts(vehicle) {
  return {
    eta: formatVehicleEta(vehicle),
    fare: formatVehicleFare(vehicle) || null,
    peak: Boolean(vehicle.peak),
  }
}

/**
 * Bottom sheet on success — same provider / mode / vehicle UI as RouteCard (`mt-mile`),
 * then parent navigates to /cab?service=drop&order=…
 */
export function DropServiceSheet({ open, fromLabel, journey, trip, pgStatus, onClose, onConfirm }) {
  const [modeId, setModeId] = useState(LAST_MILE_MODE_DEFAULT)
  const [providerExpanded, setProviderExpanded] = useState(false)
  const [providerId, setProviderId] = useState(null)
  const [selectedVehicleId, setSelectedVehicleId] = useState(null)
  const [refexVehicles, setRefexVehicles] = useState([])
  const [liveStatus, setLiveStatus] = useState('idle')
  const [liveError, setLiveError] = useState('')

  const providers = journey?.lastMileProviders?.length
    ? journey.lastMileProviders
    : LAST_MILE_PROVIDERS
  const modeOptions = journey?.lastMileOptions?.length
    ? journey.lastMileOptions
    : LAST_MILE_OPTIONS

  useEffect(() => {
    if (!open) return
    setModeId(LAST_MILE_MODE_DEFAULT)
    setProviderExpanded(false)
    setProviderId(null)
    setSelectedVehicleId(null)
    setRefexVehicles([])
    setLiveStatus('idle')
    setLiveError('')
  }, [open])

  useEffect(() => {
    if (!open || !providerExpanded || providerId !== 'refex') {
      return undefined
    }
    if (!journey && !trip) {
      setLiveStatus('loading')
      setLiveError('')
      return undefined
    }

    const controller = new AbortController()
    setLiveStatus('loading')
    setLiveError('')

    searchRefexForJourney(
      { journey, trip, serviceId: 'drop', pgStatus },
      { signal: controller.signal },
    )
      .then((result) => {
        setRefexVehicles(result.vehicles)
        setLiveStatus('ready')
        if (import.meta.env.DEV) {
          console.info('[drop] refex vehicles', result.vehicles)
        }
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setRefexVehicles([])
        setLiveStatus('error')
        setLiveError(error.message || 'Refex search failed')
        if (import.meta.env.DEV) {
          console.warn('[drop] refex search failed', error)
        }
      })

    return () => controller.abort()
  }, [open, providerExpanded, providerId, journey, trip, pgStatus])

  const liveVehicles = providerId === 'refex' ? refexVehicles : undefined

  const providerSlots = useMemo(() => {
    if (!providerExpanded || !providerId) return []
    return getProviderCardSlots(providerId, liveVehicles)
  }, [providerExpanded, providerId, liveVehicles])

  const hasProviderOptions = providerSlots.some(Boolean)

  useEffect(() => {
    if (!providerExpanded || !hasProviderOptions) {
      setSelectedVehicleId(null)
      return
    }
    setSelectedVehicleId((current) =>
      current && providerSlots.some((vehicle) => vehicle?.id === current) ? current : null,
    )
  }, [providerExpanded, hasProviderOptions, providerSlots])

  // Prefer first available slot once search returns (same as RouteCard intent).
  useEffect(() => {
    if (!providerExpanded || !hasProviderOptions || selectedVehicleId) return
    const first = providerSlots.find((vehicle) => vehicle && !vehicle.unavailable)
    if (first) {
      setSelectedVehicleId(first.id)
      if (first.mode) setModeId(first.mode)
    }
  }, [providerExpanded, hasProviderOptions, providerSlots, selectedVehicleId])

  const selectedVehicle = useMemo(
    () => providerSlots.find((vehicle) => vehicle?.id === selectedVehicleId) || null,
    [providerSlots, selectedVehicleId],
  )

  const canConfirm = Boolean(
    journey?.id &&
      providerId &&
      isProviderEnabled(providerId) &&
      providerExpanded &&
      selectedVehicle &&
      !selectedVehicle.unavailable,
  )

  if (!open) return null

  const station =
    fromLabel || journey?.destinationStation || journey?.egress?.fromLabel || 'Station'

  let providerEmptyMessage = 'No options for this mode.'
  if (providerId === 'refex') {
    if (modeId !== 'cab') providerEmptyMessage = 'Refex is available for cab only.'
    else if (!journey) providerEmptyMessage = 'Loading journey details…'
    else if (liveStatus === 'loading') providerEmptyMessage = 'Searching Refex…'
    else if (liveStatus === 'error') providerEmptyMessage = liveError || 'Refex search failed.'
    else if (liveStatus === 'ready') providerEmptyMessage = 'No Refex cabs for this drop.'
  }

  function selectLastMile(nextModeId) {
    if (nextModeId === modeId) return
    setModeId(nextModeId)
    if (providerId && isProviderDisabledForMode(providerId, nextModeId)) {
      setProviderId(null)
      setProviderExpanded(false)
      setSelectedVehicleId(null)
    }
  }

  function selectProvider(nextProviderId) {
    if (!isProviderEnabled(nextProviderId) || isProviderDisabledForMode(nextProviderId, modeId)) {
      return
    }
    setProviderId(nextProviderId)
    setProviderExpanded(true)
    setSelectedVehicleId(null)
  }

  function selectVehicleSlot(vehicleId) {
    const vehicle = providerSlots.find((item) => item?.id === vehicleId)
    if (!vehicle || vehicle.unavailable) return
    setSelectedVehicleId(vehicleId)
    if (vehicle.mode) setModeId(vehicle.mode)
  }

  function handleConfirm() {
    if (!canConfirm || !selectedVehicle) return
    onConfirm?.({
      providerId,
      modeId: selectedVehicle.mode || modeId,
      vehicleId: selectedVehicle.id || null,
      vehicle: selectedVehicle,
    })
  }

  return (
    <div className="mt-drop-sheet" role="dialog" aria-modal="true" aria-labelledby="mt-drop-title">
      <button type="button" className="mt-drop-sheet__backdrop" aria-label="Dismiss" onClick={onClose} />
      <div className="mt-drop-sheet__panel">
        <p id="mt-drop-title" className="mt-drop-sheet__title">
          Need ride from
        </p>

        {/* Same last-mile block as RouteCard — modes + provider list / vehicle slots */}
        <div className="mt-mile mt-drop-sheet__mile">
          <div className="mt-mile__row">
            <div className="mt-mile__origin">
              <PinIcon size={14} className="mt-mile__pin" />
              <div className="mt-mile__places">
                <span className="mt-mile__station">{station}</span>
              </div>
            </div>

            {providerExpanded ? (
              <button
                type="button"
                className="mt-mile__more"
                onClick={() => {
                  setProviderExpanded(false)
                  setSelectedVehicleId(null)
                }}
              >
                Check Others
              </button>
            ) : (
              <div className="mt-mile__modes" role="group" aria-label="Drop service modes">
                {modeOptions.map((mileOption) => {
                  const id = mileOption.id || mileOption.mode
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`mt-mile__mode${modeId === id ? ' is-selected' : ''}`}
                      onClick={() => selectLastMile(id)}
                    >
                      <ModeIcon mode={mileOption.mode || id} size={18} className="mt-mile__mode-icon" />
                      {mileOption.label}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {providerExpanded ? (
            <div
              className="mt-provider-options"
              role="region"
              aria-label={`${providerId} ride options`}
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
                      onClick={() => selectVehicleSlot(vehicle.id)}
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
            <div className="mt-providers" role="list" aria-label="Ride providers">
              {providers.map((provider) => {
                const disabled = isProviderDisabledForMode(provider.id, modeId)
                return (
                  <button
                    key={provider.id}
                    type="button"
                    role="listitem"
                    disabled={disabled}
                    aria-disabled={disabled || undefined}
                    title={providerDisabledReason(provider.id, modeId)}
                    className={`mt-providers__cell mt-providers__cell--${provider.id}${disabled ? ' is-disabled' : ''}`}
                    onClick={() => selectProvider(provider.id)}
                  >
                    <BrandLogo id={provider.id} name={provider.name} />
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {!journey?.id ? (
          <p className="mt-drop-sheet__hint" role="status">
            Loading journey details…
          </p>
        ) : null}

        <button
          type="button"
          className="mt-drop-sheet__cta"
          onClick={handleConfirm}
          disabled={!canConfirm}
        >
          Confirm
        </button>
      </div>
    </div>
  )
}
