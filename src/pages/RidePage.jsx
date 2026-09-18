import { useCallback, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { useSetAtom } from 'jotai'
import { helplineNumber } from '../api/config'
import { AppLogo, BackIcon, ChevronIcon, PhoneIcon } from '../components/icons'
import { LAST_MILE_PROVIDERS } from '../constants/lastMile'
import { useAppNavigate } from '../hooks/useAppNavigate'
import { GOTO_HOME_PATH } from '../lib/appContext'
import { cabDirectPath } from '../lib/cabDirect'
import { ensureOlaToken } from '../lib/olaLink'
import { peekOlaOauthResume, takeOlaOauthResume } from '../lib/olaOauth'
import { hasUsableOlaUserToken } from '../lib/olaToken'
import { hasRequiredTripParams, parseTripQuery } from '../lib/tripQuery'
import { lastMileSelectionAtom, tripAtom } from '../store/journey'
import './RidePage.css'

const AGGREGATOR_COPY = {
  ola: 'Book a cab for a comfortable and safe ride',
  rapido: 'Quick and affordable bike taxi rides',
  refex: 'Reliable and eco-friendly EV rides',
}

/**
 * /ride?from_lat&from_lon&to_lat&to_lon&from&to
 * Cab-only entry: pick aggregator, then existing /cab (no metro token).
 */
export function RidePage() {
  const location = useLocation()
  const navigate = useAppNavigate()
  const setTrip = useSetAtom(tripAtom)
  const setLastMile = useSetAtom(lastMileSelectionAtom)

  const paramsOk = hasRequiredTripParams(location.search)
  const trip = useMemo(() => parseTripQuery(location.search), [location.search])

  useEffect(() => {
    if (!paramsOk) return
    setTrip(parseTripQuery(location.search))
  }, [paramsOk, location.search, setTrip])

  function goHome() {
    navigate(GOTO_HOME_PATH, { replace: true })
  }

  const goToProvider = useCallback(
    (providerId) => {
      setLastMile({
        journeyId: 'direct',
        cabDirect: true,
        needRide: true,
        providerId,
        serviceId: 'pickup',
      })
      navigate(cabDirectPath({ trip, providerId }))
    },
    [navigate, setLastMile, trip],
  )

  async function chooseProvider(providerId) {
    if (providerId === 'ola') {
      const result = await ensureOlaToken({
        resume: { kind: 'ride', providerId: 'ola' },
      })
      if (result.source === 'oauth') return
    }
    goToProvider(providerId)
  }

  useEffect(() => {
    if (!paramsOk) return
    const resume = peekOlaOauthResume()
    if (resume?.kind !== 'ride') return
    takeOlaOauthResume()
    if (!hasUsableOlaUserToken()) return
    goToProvider(resume.providerId || 'ola')
  }, [goToProvider, paramsOk])

  const telHref = helplineNumber ? `tel:${helplineNumber.replace(/[^\d+]/g, '')}` : undefined

  return (
    <section className="mt-ride">
      <header className="mt-ride__header">
        <button type="button" className="mt-ride__icon-btn" onClick={goHome} aria-label="Go back">
          <BackIcon size={28} />
        </button>
        <AppLogo width={60} height={58} className="mt-ride__logo" />
        {telHref ? (
          <a className="mt-ride__icon-btn" href={telHref} aria-label="Call support">
            <PhoneIcon size={20} />
          </a>
        ) : (
          <button type="button" className="mt-ride__icon-btn" aria-label="Call support">
            <PhoneIcon size={20} />
          </button>
        )}
      </header>

      {!paramsOk ? (
        <p className="mt-ride__empty">
          Open this page with pickup and drop coordinates:
          <br />
          <code>from_lat</code>, <code>from_lon</code>, <code>to_lat</code>, <code>to_lon</code>
        </p>
      ) : (
        <div className="mt-ride__list">
          {LAST_MILE_PROVIDERS.map((provider) => (
            <button
              key={provider.id}
              type="button"
              className="mt-ride__card"
              onClick={() => chooseProvider(provider.id)}
            >
              <span className="mt-ride__brand">
                <img src={provider.logo} alt="" draggable={false} />
              </span>
              <span className="mt-ride__copy">
                <strong>{provider.name}</strong>
                <span>{AGGREGATOR_COPY[provider.id]}</span>
              </span>
              <ChevronIcon size={16} className="mt-ride__chevron" />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
