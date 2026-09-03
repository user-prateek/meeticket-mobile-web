import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import rapidoBike from '../assets/vehicles/rapido_bike.png'
import {
  haversineKm,
  reverseGeocodeShortName,
  shortNameFromFormattedAddress,
} from '../lib/geocode'
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, loadGoogleMaps } from '../lib/googleMaps'
import { DropMarker } from './map/DropMarker'
import { PickupMarker } from './map/PickupMarker'
import './CabMap.css'
import './map/mapMarkers.css'

function formatKm(km) {
  if (!Number.isFinite(km) || km <= 0) return { value: '1', unit: 'KM' }
  if (km < 1) return { value: km < 0.1 ? '0.1' : km.toFixed(1), unit: 'KM' }
  return { value: String(Math.round(km)), unit: 'KM' }
}

function parseDistanceProp(distance) {
  if (distance == null || distance === '') return null
  if (typeof distance === 'number' && Number.isFinite(distance)) return formatKm(distance)
  const text = String(distance).trim()
  const match = text.match(/^([\d.]+)\s*([a-zA-Z]+)?$/)
  if (!match) return null
  const unit = (match[2] || 'KM').toUpperCase()
  return { value: match[1], unit }
}

function AdvancedMarkerCtor(gmaps) {
  return gmaps.marker?.AdvancedMarkerElement || window.google?.maps?.marker?.AdvancedMarkerElement || null
}

function mountHtmlMarker({ gmaps, map, position, zIndex, node }) {
  const host = document.createElement('div')
  host.className = 'mt-map-marker-host'
  const root = createRoot(host)
  root.render(node)

  const AdvancedMarkerElement = AdvancedMarkerCtor(gmaps)
  let marker

  try {
    if (!AdvancedMarkerElement) throw new Error('no advanced marker')
    marker = new AdvancedMarkerElement({
      map,
      position,
      content: host,
      zIndex,
      gmpClickable: false,
    })
  } catch {
    marker = new HtmlOverlayMarker(gmaps, { map, position, content: host, zIndex })
  }

  return {
    update(nextNode) {
      root.render(nextNode)
    },
    clear() {
      if (marker instanceof HtmlOverlayMarker) {
        marker.setMap(null)
      } else {
        marker.map = null
      }
      root.unmount()
    },
  }
}

/** Fallback when AdvancedMarkerElement / mapId is unavailable. */
class HtmlOverlayMarker {
  constructor(gmaps, { map, position, content, zIndex }) {
    this.position = position
    this.content = content
    this.zIndex = zIndex ?? 0
    this.div = null
    const overlay = new gmaps.OverlayView()
    overlay.onAdd = () => {
      this.div = this.content
      this.div.style.position = 'absolute'
      this.div.style.zIndex = String(this.zIndex)
      overlay.getPanes().overlayMouseTarget.appendChild(this.div)
    }
    overlay.draw = () => {
      const projection = overlay.getProjection()
      if (!projection || !this.div) return
      const point = projection.fromLatLngToDivPixel(
        new gmaps.LatLng(this.position.lat, this.position.lng),
      )
      if (!point) return
      this.div.style.left = `${point.x}px`
      this.div.style.top = `${point.y}px`
    }
    overlay.onRemove = () => {
      this.div?.parentNode?.removeChild(this.div)
      this.div = null
    }
    overlay.setMap(map)
    this.overlay = overlay
  }

  setMap(map) {
    this.overlay.setMap(map)
  }
}

/**
 * Google Map for cab first/last mile: custom pickup/drop HTML markers + driving path.
 */
export function CabMap({ from, to, className, vehicleSrc, distance }) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const vehicle = vehicleSrc || rapidoBike

  useEffect(() => {
    if (!from || !to || !hostRef.current) return undefined

    let cancelled = false

    function clearOverlays() {
      overlaysRef.current.forEach((item) => {
        if (item?.clear) item.clear()
        else if (item?.setMap) item.setMap(null)
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
            mapId: GOOGLE_MAPS_MAP_ID,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: 'greedy',
            clickableIcons: false,
          })
        }

        const map = mapRef.current
        const parsed = parseDistanceProp(distance)
        const fallback = formatKm(haversineKm(from.lat, from.lng, to.lat, to.lng))
        let badge = parsed || fallback
        let pickupName = from.label || 'Pickup'
        let dropName = to.label || 'Drop'
        const lockPickup = Boolean(from.lockLabel)
        const lockDrop = Boolean(to.lockLabel)

        function paintMarkers() {
          pickup.update(
            <PickupMarker
              vehicleSrc={vehicle}
              placeName={pickupName}
              distanceValue={badge.value}
              distanceUnit={badge.unit}
            />,
          )
          drop.update(<DropMarker placeName={dropName} />)
        }

        const pickup = mountHtmlMarker({
          gmaps,
          map,
          position: origin,
          zIndex: 2,
          node: (
            <PickupMarker
              vehicleSrc={vehicle}
              placeName={pickupName}
              distanceValue={badge.value}
              distanceUnit={badge.unit}
            />
          ),
        })
        const drop = mountHtmlMarker({
          gmaps,
          map,
          position: destination,
          zIndex: 1,
          node: <DropMarker placeName={dropName} />,
        })
        overlaysRef.current.push(pickup, drop)

        // Only reverse-geocode user-side points. Station labels stay from the journey API.
        const geocodeJobs = []
        if (!lockPickup) {
          geocodeJobs.push(
            reverseGeocodeShortName(origin.lat, origin.lng).then((name) => {
              if (!cancelled && name) pickupName = name
            }),
          )
        }
        if (!lockDrop) {
          geocodeJobs.push(
            reverseGeocodeShortName(destination.lat, destination.lng).then((name) => {
              if (!cancelled && name) dropName = name
            }),
          )
        }
        if (geocodeJobs.length) {
          Promise.all(geocodeJobs)
            .then(() => {
              if (!cancelled) paintMarkers()
            })
            .catch(() => {})
        }

        const renderer = new gmaps.DirectionsRenderer({
          map,
          suppressMarkers: true,
          preserveViewport: true,
          polylineOptions: {
            strokeColor: '#000000',
            strokeOpacity: 1,
            strokeWeight: 6,
          },
        })
        overlaysRef.current.push(renderer)

        const service = new gmaps.DirectionsService()
        service.route(
          {
            origin,
            destination,
            travelMode: gmaps.TravelMode.DRIVING,
            provideRouteAlternatives: false,
          },
          (result, routeStatus) => {
            if (cancelled) return
            if (routeStatus === 'OK' && result) {
              renderer.setDirections(result)
              const routeBounds = result.routes?.[0]?.bounds
              if (routeBounds) {
                map.fitBounds(routeBounds, { top: 48, right: 140, bottom: 56, left: 48 })
              }
              const leg = result.routes?.[0]?.legs?.[0]
              const meters = leg?.distance?.value
              if (!parsed && Number.isFinite(meters)) {
                badge = formatKm(meters / 1000)
              }
              if (!lockPickup) {
                const dirFrom = shortNameFromFormattedAddress(leg?.start_address)
                if (dirFrom && pickupName === (from.label || 'Pickup')) pickupName = dirFrom
              }
              if (!lockDrop) {
                const dirTo = shortNameFromFormattedAddress(leg?.end_address)
                if (dirTo && dropName === (to.label || 'Drop')) dropName = dirTo
              }
              paintMarkers()
              setStatus('ready')
              setError('')
              return
            }
            setStatus('error')
            setError(
              `Driving route failed (${routeStatus}). Enable Directions API for this key.`,
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
  }, [from?.lat, from?.lng, from?.label, to?.lat, to?.lng, to?.label, vehicle, distance])

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
