import { useEffect, useRef, useState } from 'react'
import { GOOGLE_MAPS_API_KEY, loadGoogleMaps } from '../lib/googleMaps'
import './CabMap.css'

/**
 * Google Map for cab first/last mile: A/B markers + walking directions path.
 */
export function CabMap({ from, to, className }) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!from || !to || !hostRef.current) return undefined

    let cancelled = false

    function clearOverlays() {
      overlaysRef.current.forEach((item) => {
        if (item?.setMap) item.setMap(null)
      })
      overlaysRef.current = []
    }

    setStatus('loading')
    setError('')

    loadGoogleMaps()
      .then((gmaps) => {
        if (cancelled || !hostRef.current) return

        if (typeof gmaps.Map !== 'function') {
          throw new Error('Google Maps Map constructor is not ready')
        }

        clearOverlays()

        const origin = { lat: from.lat, lng: from.lng }
        const destination = { lat: to.lat, lng: to.lng }

        if (!mapRef.current) {
          mapRef.current = new gmaps.Map(hostRef.current, {
            center: origin,
            zoom: 15,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'greedy',
            clickableIcons: false,
          })
        }

        const map = mapRef.current

        overlaysRef.current.push(
          new gmaps.Marker({
            map,
            position: origin,
            title: from.label,
            label: { text: 'A', color: '#fff', fontWeight: '700' },
          }),
          new gmaps.Marker({
            map,
            position: destination,
            title: to.label,
            label: { text: 'B', color: '#fff', fontWeight: '700' },
          }),
        )

        const renderer = new gmaps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: false,
          polylineOptions: {
            strokeColor: '#407AFE',
            strokeOpacity: 0.95,
            strokeWeight: 5,
          },
        })
        overlaysRef.current.push(renderer)

        const service = new gmaps.DirectionsService()
        service.route(
          {
            origin,
            destination,
            travelMode: gmaps.TravelMode.WALKING,
            provideRouteAlternatives: false,
          },
          (result, routeStatus) => {
            if (cancelled) return
            if (routeStatus === 'OK' && result) {
              renderer.setDirections(result)
              setStatus('ready')
              setError('')
              return
            }
            setStatus('error')
            setError(
              `Walking route failed (${routeStatus}). Enable Directions API for this key.`,
            )
            const bounds = new gmaps.LatLngBounds()
            bounds.extend(origin)
            bounds.extend(destination)
            map.fitBounds(bounds, 64)
          },
        )
      })
      .catch((err) => {
        if (cancelled) return
        setStatus('error')
        setError(err.message || 'Could not load map')
      })

    return () => {
      cancelled = true
      clearOverlays()
    }
  }, [from?.lat, from?.lng, from?.label, to?.lat, to?.lng, to?.label])

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className={`mt-cab-map mt-cab-map--empty ${className || ''}`.trim()}>
        <p>
          Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to <code>.env</code> to show the map.
        </p>
      </div>
    )
  }

  if (!from || !to) {
    return (
      <div className={`mt-cab-map mt-cab-map--empty ${className || ''}`.trim()}>
        <p>Location coordinates are missing for this trip.</p>
      </div>
    )
  }

  return (
    <div className={`mt-cab-map ${className || ''}`.trim()}>
      <div ref={hostRef} className="mt-cab-map__canvas" />
      {status === 'loading' ? <p className="mt-cab-map__loading">Loading map…</p> : null}
      {error ? <p className="mt-cab-map__error">{error}</p> : null}
    </div>
  )
}
