import { useEffect, useMemo, useState } from 'react'
import { CabMap } from '../../components/CabMap'
import { BackIcon, ModeIcon } from '../../components/icons'
import {
  LAST_MILE_MODE_DEFAULT,
  LAST_MILE_PROVIDER_DEFAULT,
  LAST_MILE_PROVIDERS,
  formatFare,
  getLastMileModes,
  getLastMileProvider,
  getLastMileVehicles,
} from '../../constants/lastMile'
import { preloadGoogleMaps, resolveCabMapPoints } from '../../lib/googleMaps'
import './LastMilePage.css'

function optionMeta(vehicle) {
  if (vehicle.subtitle) return vehicle.subtitle
  const parts = []
  if (vehicle.etaMin != null) parts.push(`${vehicle.etaMin} mins`)
  if (vehicle.dropTime) parts.push(`Drop ${vehicle.dropTime}`)
  return parts.join(' • ')
}

export function LastMilePage({
  journey,
  serviceId,
  mile,
  trip,
  onBack,
  onBook,
  fromPlace = 'Ameerpet',
  toPlace = 'L.B. Nagar',
}) {
  const [providerId, setProviderId] = useState(LAST_MILE_PROVIDER_DEFAULT)
  const [modeId, setModeId] = useState(LAST_MILE_MODE_DEFAULT)
  const [selectedId, setSelectedId] = useState('')

  const provider = getLastMileProvider(providerId)
  const modes = useMemo(() => getLastMileModes(providerId), [providerId])
  const vehicles = useMemo(
    () => getLastMileVehicles(providerId, modeId),
    [providerId, modeId],
  )

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

  useEffect(() => {
    preloadGoogleMaps()
  }, [])

  useEffect(() => {
    if (modes.length === 0) {
      setModeId(LAST_MILE_MODE_DEFAULT)
      setSelectedId('')
      return
    }
    if (!modes.some((mode) => mode.id === modeId)) {
      setModeId(modes[0].id)
    }
  }, [modes, modeId])

  useEffect(() => {
    if (vehicles.length === 0) {
      setSelectedId('')
      return
    }
    if (!vehicles.some((vehicle) => vehicle.id === selectedId)) {
      setSelectedId(vehicles[0].id)
    }
  }, [vehicles, selectedId])

  const selected = vehicles.find((vehicle) => vehicle.id === selectedId)

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
        {mile ? (
          <p className="mt-lastmile-page__mile-hint">
            {serviceId === 'drop' ? 'Last mile' : 'First mile'} · {mile.mode}{' '}
            {mile.distanceM} m · ~{mile.durationMin} Min (or book a ride)
          </p>
        ) : null}
        <div className="mt-lastmile-page__tabs" role="tablist" aria-label="Ride providers">
          {LAST_MILE_PROVIDERS.map((item) => {
            const active = providerId === item.id
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={`mt-lastmile-page__tab mt-lastmile-page__tab--${item.id}${active ? ' is-active' : ''}`}
                style={active ? { borderBottomColor: item.accent } : undefined}
                onClick={() => setProviderId(item.id)}
              >
                <img
                  className={`mt-lastmile-page__tab-logo mt-lastmile-page__tab-logo--${item.id}`}
                  src={item.logo}
                  alt={item.name}
                  draggable={false}
                />
              </button>
            )
          })}
        </div>

        {modes.length > 0 ? (
          <div className="mt-lastmile-page__modes" role="tablist" aria-label="Vehicle type">
            {modes.map((mode) => {
              const active = modeId === mode.id
              return (
                <button
                  key={mode.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  className={`mt-lastmile-page__mode${active ? ' is-active' : ''}`}
                  onClick={() => setModeId(mode.id)}
                >
                  <ModeIcon
                    mode={mode.id}
                    size={16}
                    color={active ? '#ffffff' : '#666666'}
                    className="mt-lastmile-page__mode-icon"
                  />
                  {mode.label}
                </button>
              )
            })}
          </div>
        ) : null}

        <div className="mt-lastmile-page__panel" role="tabpanel">
          {vehicles.length === 0 ? (
            <p className="mt-lastmile-page__empty">
              {providerId === 'refex' ? 'Refex options coming soon.' : 'No vehicles available.'}
            </p>
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
                      onClick={() => setSelectedId(vehicle.id)}
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
                          {vehicle.faster ? <span className="mt-lastmile-page__faster">Faster</span> : null}
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
            <button
              type="button"
              className="mt-lastmile-page__book"
              onClick={() => onBook?.({ vehicle: selected, providerId, modeId })}
            >
              Book {selected.label} · {formatFare(selected.fareInr)}
            </button>
            {journey?.payment ? (
              <p className="mt-lastmile-page__pay-note">Pay with {journey.payment.method}</p>
            ) : null}
          </div>
        ) : null}

        {provider ? <span className="sr-only">{provider.name} options</span> : null}
      </div>
    </section>
  )
}
