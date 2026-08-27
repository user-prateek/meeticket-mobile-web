import { useEffect, useMemo, useState } from 'react'
import { CabMap } from '../../components/CabMap'
import { BackIcon, ModeIcon } from '../../components/icons'
import {
  LAST_MILE_MODE_DEFAULT,
  LAST_MILE_MODES,
  LAST_MILE_PROVIDER_DEFAULT,
  formatFare,
  getLastMileProvider,
  getLastMileVehicles,
  providerSupportsMode,
} from '../../constants/lastMile'
import { blockRefexCab, searchRefexHardcodedTestCached } from '../../api/refex'
import { preloadGoogleMaps, resolveCabMapPoints } from '../../lib/googleMaps'
import './LastMilePage.css'

function optionMeta(vehicle) {
  if (vehicle.subtitle) return vehicle.subtitle
  const parts = []
  if (vehicle.dropTime) parts.push(vehicle.dropTime)
  if (vehicle.etaMin != null) parts.push(`${vehicle.etaMin} min`)
  return parts.join(' · ')
}

export function LastMilePage({
  journey,
  serviceId,
  mile,
  trip,
  onBack,
  onBook,
  onSelectionChange,
  initialProviderId,
  initialModeId,
  initialVehicleId,
  fromPlace = 'Ameerpet',
  toPlace = 'L.B. Nagar',
}) {
  const providerId = initialProviderId || LAST_MILE_PROVIDER_DEFAULT

  const [modeId, setModeId] = useState(() => {
    const preferred = initialModeId || LAST_MILE_MODE_DEFAULT
    return providerSupportsMode(providerId, preferred) ? preferred : LAST_MILE_MODE_DEFAULT
  })
  const [selectedId, setSelectedId] = useState(() => initialVehicleId || '')
  const [refexVehicles, setRefexVehicles] = useState([])
  const [refexStatus, setRefexStatus] = useState('idle')
  const [refexError, setRefexError] = useState('')
  const [bookingStatus, setBookingStatus] = useState('idle')
  const [bookError, setBookError] = useState('')

  const provider = getLastMileProvider(providerId)

  const staticVehicles = useMemo(
    () => getLastMileVehicles(providerId, modeId),
    [providerId, modeId],
  )

  const vehicles = useMemo(() => {
    if (providerId !== 'refex') return staticVehicles
    return refexVehicles.filter((vehicle) => !modeId || vehicle.mode === modeId)
  }, [providerId, staticVehicles, refexVehicles, modeId])

  const mapPoints = useMemo(
    () =>
      resolveCabMapPoints({
        serviceId,
        mile,
        trip,
        fromLabel: fromPlace,
        toLabel: toPlace,
      }),
    [serviceId, mile, trip, fromPlace, toPlace],
  )

  function syncSelection(nextModeId, nextVehicleId) {
    onSelectionChange?.({
      providerId,
      modeId: nextModeId,
      vehicleId: nextVehicleId || null,
    })
  }

  function handleModeChange(nextModeId) {
    if (nextModeId === modeId) return
    if (!providerSupportsMode(providerId, nextModeId)) return
    setModeId(nextModeId)
    setSelectedId('')
    setBookError('')
    setBookingStatus('idle')
    syncSelection(nextModeId, null)
  }

  function handleVehicleSelect(nextVehicleId) {
    setSelectedId(nextVehicleId)
    syncSelection(modeId, nextVehicleId)
  }

  useEffect(() => {
    preloadGoogleMaps()
  }, [])

  // Keep local selection in sync when query params change (e.g. navigating from detail).
  useEffect(() => {
    const preferred = initialModeId || LAST_MILE_MODE_DEFAULT
    const nextMode = providerSupportsMode(providerId, preferred) ? preferred : LAST_MILE_MODE_DEFAULT
    setModeId(nextMode)
    setSelectedId(initialVehicleId || '')
    setBookError('')
    setBookingStatus('idle')
  }, [providerId, initialModeId, initialVehicleId])

  useEffect(() => {
    if (providerId !== 'refex' || modeId !== 'cab') {
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
  }, [providerId, modeId])

  useEffect(() => {
    if (vehicles.length === 0) {
      setSelectedId('')
      return
    }
    if (!vehicles.some((vehicle) => vehicle.id === selectedId)) {
      const preferred =
        initialVehicleId && vehicles.some((vehicle) => vehicle.id === initialVehicleId)
          ? initialVehicleId
          : vehicles[0].id
      setSelectedId(preferred)
    }
  }, [vehicles, selectedId, initialVehicleId])

  const selected = vehicles.find((vehicle) => vehicle.id === selectedId)
  const isBooking = bookingStatus === 'loading'

  async function handleBookClick() {
    if (!selected || isBooking) return
    setBookError('')
    setBookingStatus('loading')

    try {
      let refexBlock = null
      if (providerId === 'refex') {
        refexBlock = await blockRefexCab({
          searchId: selected.searchId,
          vehicle: selected,
          distanceKm: selected.distanceKm,
        })
      }

      await onBook?.({ vehicle: selected, providerId, modeId, refexBlock })
      setBookingStatus('ready')
    } catch (error) {
      if (error?.name === 'AbortError') return
      setBookingStatus('error')
      setBookError(error.message || 'Could not book this ride')
    }
  }

  let emptyMessage = 'No vehicles available.'
  if (providerId === 'refex') {
    if (refexStatus === 'loading') emptyMessage = 'Searching Refex…'
    else if (refexStatus === 'error') emptyMessage = refexError || 'Refex search failed.'
    else emptyMessage = 'No Refex cars for this trip.'
  }

  return (
    <section className="mt-lastmile-page">
      <div className="mt-lastmile-page__map" aria-label="Map">
        <div className="mt-lastmile-page__map-canvas">
          <CabMap from={mapPoints?.from} to={mapPoints?.to} />

          <button type="button" className="mt-lastmile-page__back" onClick={onBack} aria-label="Go back">
            <BackIcon size={20} />
          </button>
        </div>
      </div>

      <div className="mt-lastmile-page__sheet">
        <div className="mt-lastmile-page__modes" role="tablist" aria-label="Vehicle type">
          {LAST_MILE_MODES.map((mode) => {
            const active = modeId === mode.id
            const disabled = !providerSupportsMode(providerId, mode.id)
            return (
              <button
                key={mode.id}
                type="button"
                role="tab"
                aria-selected={active}
                aria-disabled={disabled || undefined}
                disabled={disabled}
                title={
                  disabled
                    ? `${provider?.name || 'This provider'} is available for cab only`
                    : undefined
                }
                className={`mt-lastmile-page__mode${active ? ' is-active' : ''}${disabled ? ' is-disabled' : ''}`}
                onClick={() => handleModeChange(mode.id)}
              >
                <ModeIcon
                  mode={mode.id}
                  size={16}
                  color={active ? 'var(--mt-navy)' : '#666666'}
                  className="mt-lastmile-page__mode-icon"
                />
                {mode.label}
              </button>
            )
          })}
        </div>

        <div className="mt-lastmile-page__panel" role="tabpanel">
          {vehicles.length === 0 ? (
            <p className="mt-lastmile-page__empty">{emptyMessage}</p>
          ) : (
            <ul className="mt-lastmile-page__list">
              {vehicles.map((vehicle) => {
                const active = selectedId === vehicle.id
                const meta = optionMeta(vehicle)
                return (
                  <li key={vehicle.id}>
                    <button
                      type="button"
                      className={`mt-lastmile-page__option${active ? ' is-selected' : ''}`}
                      onClick={() => handleVehicleSelect(vehicle.id)}
                    >
                      <img
                        className="mt-lastmile-page__vehicle"
                        src={vehicle.icon}
                        alt=""
                        draggable={false}
                      />
                      <div className="mt-lastmile-page__copy">
                        <div className="mt-lastmile-page__title-row">
                          <strong>{vehicle.label}</strong>
                          {vehicle.faster ? (
                            <span className="mt-lastmile-page__faster">Faster</span>
                          ) : null}
                        </div>
                        {meta ? <span className="mt-lastmile-page__meta">{meta}</span> : null}
                      </div>
                      <strong className="mt-lastmile-page__fare">{formatFare(vehicle.fareInr)}</strong>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {selected ? (
          <div className="mt-lastmile-page__footer">
            <div className="mt-lastmile-page__footer-row">
              {provider?.logo ? (
                <img
                  className={`mt-lastmile-page__footer-logo mt-lastmile-page__footer-logo--${provider.id}`}
                  src={provider.logo}
                  alt={provider.name}
                  draggable={false}
                />
              ) : null}
              <button
                type="button"
                className="mt-lastmile-page__book"
                disabled={isBooking}
                onClick={handleBookClick}
              >
                Book {selected.label} · {formatFare(selected.fareInr)}
              </button>
            </div>
            {bookError ? <p className="mt-lastmile-page__book-error">{bookError}</p> : null}
          </div>
        ) : null}

        {provider ? <span className="sr-only">{provider.name} options</span> : null}
      </div>
    </section>
  )
}
