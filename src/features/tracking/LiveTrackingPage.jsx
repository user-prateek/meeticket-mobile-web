import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import rapidoBike from '../../assets/vehicles/rapido_bike.png'
import { BackIcon, CloseIcon, PhoneIcon } from '../../components/icons'
import {
  fetchTrackingRoute,
  LIVE_TRACKING_DEMO,
  startMockGpsAlongPath,
} from '../../lib/mockGps'
import { reverseGeocodeShortName } from '../../lib/geocode'
import { LiveTrackingMap } from './LiveTrackingMap'
import './LiveTrackingPage.css'

const DEMO_CAPTAIN = {
  name: 'Ramesh Kumar',
  role: 'Your Captain',
  vehicle: 'Hero Splendor Plus',
  plate: 'KA 01 AB 1234',
  rating: '4.8',
}

function ShieldIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 5 6v5c0 4.5 2.8 7.8 7 9 4.2-1.2 7-4.5 7-9V6l-7-3Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function ShareIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8.3 13.2 15.7 17.3M15.7 6.7 8.3 10.8" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

function MessageIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v7A2.5 2.5 0 0 1 16.5 16H10l-4 3.5V6.5Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Demo live-tracking screen.
 * Open `/live-tracking` — mock GPS follows Google Directions between demo coords.
 * Replace `startMockGpsAlongPath` with the real GPS API later (same update shape).
 */
export function LiveTrackingPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [routeMeta, setRouteMeta] = useState(null)
  const [vehicle, setVehicle] = useState(null)
  const [pickup, setPickup] = useState({
    ...LIVE_TRACKING_DEMO.pickup,
    address: LIVE_TRACKING_DEMO.pickup.address,
  })
  const [dropoff, setDropoff] = useState({
    ...LIVE_TRACKING_DEMO.dropoff,
    address: LIVE_TRACKING_DEMO.dropoff.address,
  })

  const path = routeMeta?.path || []

  const arriving = useMemo(() => {
    if (!vehicle) {
      return {
        etaMin: routeMeta?.durationSec ? Math.ceil(routeMeta.durationSec / 60) : '—',
        distanceKm: routeMeta?.totalMeters
          ? (routeMeta.totalMeters / 1000).toFixed(1)
          : '—',
      }
    }
    return {
      etaMin: vehicle.etaMin,
      distanceKm: (vehicle.remainingMeters / 1000).toFixed(1),
    }
  }, [vehicle, routeMeta])

  useEffect(() => {
    const controller = new AbortController()
    let tracker = null

    setStatus('loading')
    setError('')

    Promise.all([
      fetchTrackingRoute(LIVE_TRACKING_DEMO.pickup, LIVE_TRACKING_DEMO.dropoff, {
        signal: controller.signal,
      }),
      reverseGeocodeShortName(
        LIVE_TRACKING_DEMO.pickup.lat,
        LIVE_TRACKING_DEMO.pickup.lng,
        { signal: controller.signal },
      ).catch(() => ''),
    ])
      .then(([route, pickupName]) => {
        if (controller.signal.aborted) return
        setRouteMeta(route)
        setPickup((prev) => ({
          ...prev,
          address: pickupName || prev.address,
        }))
        // Drop is a known station endpoint for this demo — keep the station label.
        setDropoff((prev) => ({
          ...prev,
          address: LIVE_TRACKING_DEMO.dropoff.address,
        }))

        const start = route.path[0]
        setVehicle({
          lat: start.lat,
          lng: start.lng,
          bearing: 0,
          etaMin: Math.max(1, Math.ceil((route.durationSec || 900) / 60)),
          remainingMeters: route.totalMeters,
        })
        setStatus('tracking')

        tracker = startMockGpsAlongPath(
          {
            path: route.path,
            cum: route.cum,
            totalMeters: route.totalMeters,
            durationMs: LIVE_TRACKING_DEMO.durationMs,
            tickMs: LIVE_TRACKING_DEMO.tickMs,
          },
          {
            onUpdate: (next) => {
              if (controller.signal.aborted) return
              setVehicle(next)
            },
            onComplete: () => {
              if (controller.signal.aborted) return
              setStatus('arrived')
            },
          },
        )
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        setStatus('error')
        setError(err.message || 'Could not start live tracking demo')
      })

    return () => {
      controller.abort()
      tracker?.stop()
    }
  }, [])

  return (
    <section className="mt-live">
      <div className="mt-live__map">
        <LiveTrackingMap
          pickup={pickup}
          dropoff={dropoff}
          path={path}
          vehicle={vehicle}
          followVehicle={status === 'tracking'}
        />

        <header className="mt-live__header">
          <button
            type="button"
            className="mt-live__back"
            onClick={() => navigate(-1)}
            aria-label="Go back"
          >
            <BackIcon size={20} />
          </button>
          <div className="mt-live__header-copy">
            <h1>Live Tracking</h1>
            <p>Stay Safe, We&apos;ve Got You</p>
          </div>
          <div className="mt-live__header-actions">
            <button type="button" className="mt-live__chip">
              <ShieldIcon />
              <span>Safety</span>
            </button>
            <button type="button" className="mt-live__chip">
              <ShareIcon />
              <span>Share</span>
            </button>
          </div>
        </header>

        <aside className="mt-live__arriving" aria-live="polite">
          <div className="mt-live__arriving-left">
            <p className="mt-live__arriving-kicker">Arriving in</p>
            <p className="mt-live__arriving-eta">
              <strong>{arriving.etaMin}</strong>
              <span> min</span>
            </p>
            <p className="mt-live__arriving-dist">{arriving.distanceKm} km away</p>
          </div>
          <div className="mt-live__arriving-right">
            <div className="mt-live__arriving-bike" aria-hidden="true">
              <img src={rapidoBike} alt="" width={56} height={36} draggable={false} />
            </div>
            <p className="mt-live__plate">{DEMO_CAPTAIN.plate}</p>
          </div>
        </aside>

        {error ? <p className="mt-live__error">{error}</p> : null}
        {status === 'loading' ? <p className="mt-live__toast">Building route…</p> : null}
        {status === 'arrived' ? <p className="mt-live__toast">Arrived at destination</p> : null}
      </div>

      <div className="mt-live__sheet">
        <div className="mt-live__captain">
          <div className="mt-live__avatar-wrap">
            <div className="mt-live__avatar" aria-hidden="true">
              RK
            </div>
            <span className="mt-live__rating">★ {DEMO_CAPTAIN.rating}</span>
          </div>
          <div className="mt-live__captain-copy">
            <p className="mt-live__captain-name">{DEMO_CAPTAIN.name}</p>
            <p className="mt-live__captain-role">{DEMO_CAPTAIN.role}</p>
            <p className="mt-live__captain-vehicle">{DEMO_CAPTAIN.vehicle}</p>
            <p className="mt-live__plate mt-live__plate--inline">{DEMO_CAPTAIN.plate}</p>
          </div>
        </div>

        <div className="mt-live__actions">
          <button type="button" className="mt-live__action">
            <PhoneIcon size={18} />
            Call
          </button>
          <button type="button" className="mt-live__action">
            <MessageIcon size={18} />
            Message
          </button>
          <button type="button" className="mt-live__action" onClick={() => navigate(-1)}>
            <CloseIcon size={18} />
            Cancel
          </button>
        </div>
      </div>
    </section>
  )
}
