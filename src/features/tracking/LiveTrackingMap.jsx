import { useEffect, useRef } from 'react'
import { createRoot } from 'react-dom/client'
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_MAP_ID, loadGoogleMaps } from '../../lib/googleMaps'
import { TrackingBikeMarker } from './TrackingBikeMarker'
import './LiveTrackingMap.css'

function AdvancedMarkerCtor(gmaps) {
  return gmaps.marker?.AdvancedMarkerElement || window.google?.maps?.marker?.AdvancedMarkerElement || null
}

function mountHtml({ gmaps, map, position, zIndex, node }) {
  const host = document.createElement('div')
  host.className = 'mt-track-map__marker-host'
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
    marker = new OverlayHtml(gmaps, { map, position, content: host, zIndex })
  }

  return {
    setPosition(next) {
      if (marker instanceof OverlayHtml) marker.setPosition(next)
      else marker.position = next
    },
    update(nextNode) {
      root.render(nextNode)
    },
    clear() {
      if (marker instanceof OverlayHtml) marker.setMap(null)
      else marker.map = null
      root.unmount()
    },
  }
}

class OverlayHtml {
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

  setPosition(position) {
    this.position = position
    this.overlay.draw()
  }

  setMap(map) {
    this.overlay.setMap(map)
  }
}

function PlaceBubble({ kind, title, address }) {
  return (
    <div className={`mt-track-bubble mt-track-bubble--${kind}`}>
      <div className="mt-track-bubble__card">
        <p className="mt-track-bubble__title">
          <span className="mt-track-bubble__dot" aria-hidden="true" />
          {title}
        </p>
        <p className="mt-track-bubble__address">{address}</p>
      </div>
      <span className="mt-track-bubble__tail" aria-hidden="true" />
      {kind === 'pickup' ? <span className="mt-track-bubble__halo" aria-hidden="true" /> : null}
      <span className={`mt-track-bubble__pin mt-track-bubble__pin--${kind}`} aria-hidden="true" />
    </div>
  )
}

/**
 * Live tracking map: route polyline + pickup/drop bubbles + oriented vehicle marker.
 */
export function LiveTrackingMap({
  pickup,
  dropoff,
  path = [],
  vehicle,
  followVehicle = true,
  className,
}) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const polylineRef = useRef(null)
  const vehicleRef = useRef(null)
  const placeRefs = useRef([])

  useEffect(() => {
    if (!hostRef.current || !pickup || !dropoff) return undefined
    let cancelled = false

    loadGoogleMaps()
      .then((gmaps) => {
        if (cancelled || !hostRef.current) return

        if (!mapRef.current) {
          mapRef.current = new gmaps.Map(hostRef.current, {
            center: pickup,
            zoom: 14,
            mapId: GOOGLE_MAPS_MAP_ID,
            disableDefaultUI: true,
            zoomControl: false,
            gestureHandling: 'greedy',
            clickableIcons: false,
          })
        }

        const map = mapRef.current

        placeRefs.current.forEach((item) => item.clear())
        placeRefs.current = [
          mountHtml({
            gmaps,
            map,
            position: pickup,
            zIndex: 1,
            node: (
              <PlaceBubble kind="pickup" title="Pickup" address={pickup.address || pickup.label} />
            ),
          }),
          mountHtml({
            gmaps,
            map,
            position: dropoff,
            zIndex: 1,
            node: (
              <PlaceBubble
                kind="dropoff"
                title="Dropoff"
                address={dropoff.address || dropoff.label}
              />
            ),
          }),
        ]

        if (polylineRef.current) {
          polylineRef.current.setMap(null)
        }
        polylineRef.current = new gmaps.Polyline({
          map,
          path,
          strokeColor: '#000000',
          strokeOpacity: 1,
          strokeWeight: 5,
          zIndex: 0,
        })

        if (!vehicleRef.current) {
          vehicleRef.current = mountHtml({
            gmaps,
            map,
            position: vehicle || pickup,
            zIndex: 5,
            node: <TrackingBikeMarker bearing={vehicle?.bearing || 0} />,
          })
        }

        if (path.length > 1) {
          const bounds = new gmaps.LatLngBounds()
          path.forEach((p) => bounds.extend(p))
          map.fitBounds(bounds, { top: 120, right: 40, bottom: 220, left: 40 })
        }
      })
      .catch(() => {})

    return () => {
      cancelled = true
      placeRefs.current.forEach((item) => item.clear())
      placeRefs.current = []
      if (polylineRef.current) {
        polylineRef.current.setMap(null)
        polylineRef.current = null
      }
      if (vehicleRef.current) {
        vehicleRef.current.clear()
        vehicleRef.current = null
      }
    }
  }, [pickup?.lat, pickup?.lng, dropoff?.lat, dropoff?.lng, path])

  useEffect(() => {
    if (!vehicle || !vehicleRef.current) return
    vehicleRef.current.setPosition({ lat: vehicle.lat, lng: vehicle.lng })
    vehicleRef.current.update(<TrackingBikeMarker bearing={vehicle.bearing || 0} />)

    if (followVehicle && mapRef.current) {
      mapRef.current.panTo({ lat: vehicle.lat, lng: vehicle.lng })
    }
  }, [vehicle?.lat, vehicle?.lng, vehicle?.bearing, followVehicle])

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className={`mt-track-map mt-track-map--empty ${className || ''}`.trim()}>
        <p>
          Add <code>VITE_GOOGLE_MAPS_API_KEY</code> to show live tracking.
        </p>
      </div>
    )
  }

  return (
    <div className={`mt-track-map ${className || ''}`.trim()}>
      <div ref={hostRef} className="mt-track-map__canvas" />
    </div>
  )
}
