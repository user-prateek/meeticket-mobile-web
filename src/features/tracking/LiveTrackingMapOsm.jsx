import { useEffect, useRef } from 'react'
import { mountLeafletHtmlMarker } from '../../lib/leafletHtmlMarker'
import { loadLeaflet, OSM_ATTRIBUTION, OSM_TILE_URL } from '../../lib/osmMaps'
import { TrackingBikeMarker } from './TrackingBikeMarker'
import './LiveTrackingMap.css'

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
 * Live tracking map on OpenStreetMap (Leaflet).
 */
export function LiveTrackingMapOsm({
  pickup,
  dropoff,
  path = [],
  vehicle,
  followVehicle = true,
  className,
}) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const tilesRef = useRef(null)
  const polylineRef = useRef(null)
  const vehicleRef = useRef(null)
  const placeRefs = useRef([])
  const followRef = useRef(followVehicle)

  useEffect(() => {
    followRef.current = followVehicle
  }, [followVehicle])

  useEffect(() => {
    if (!hostRef.current || !pickup || !dropoff) return undefined
    let cancelled = false

    loadLeaflet()
      .then((L) => {
        if (cancelled || !hostRef.current) return

        if (!mapRef.current) {
          mapRef.current = L.map(hostRef.current, {
            center: [pickup.lat, pickup.lng],
            zoom: 14,
            zoomControl: false,
            attributionControl: true,
          })
          tilesRef.current = L.tileLayer(OSM_TILE_URL, {
            attribution: OSM_ATTRIBUTION,
            maxZoom: 19,
          }).addTo(mapRef.current)
        }

        const map = mapRef.current
        requestAnimationFrame(() => map.invalidateSize())

        placeRefs.current.forEach((item) => item.clear())
        placeRefs.current = [
          mountLeafletHtmlMarker({
            L,
            map,
            position: pickup,
            zIndex: 1,
            className: 'mt-track-map__marker-host',
            node: (
              <PlaceBubble kind="pickup" title="Pickup" address={pickup.address || pickup.label} />
            ),
          }),
          mountLeafletHtmlMarker({
            L,
            map,
            position: dropoff,
            zIndex: 1,
            className: 'mt-track-map__marker-host',
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
          map.removeLayer(polylineRef.current)
          polylineRef.current = null
        }
        if (path.length > 1) {
          polylineRef.current = L.polyline(
            path.map((p) => [p.lat, p.lng]),
            { color: '#000000', weight: 5, opacity: 1 },
          ).addTo(map)
          map.fitBounds(polylineRef.current.getBounds(), {
            paddingTopLeft: [40, 120],
            paddingBottomRight: [40, 220],
          })
        }

        if (vehicleRef.current) {
          vehicleRef.current.clear()
          vehicleRef.current = null
        }
        vehicleRef.current = mountLeafletHtmlMarker({
          L,
          map,
          position: vehicle || pickup,
          zIndex: 5,
          className: 'mt-track-map__marker-host',
          node: <TrackingBikeMarker bearing={vehicle?.bearing || 0} />,
        })
      })
      .catch(() => {})

    return () => {
      cancelled = true
      placeRefs.current.forEach((item) => item.clear())
      placeRefs.current = []
      if (polylineRef.current && mapRef.current) {
        mapRef.current.removeLayer(polylineRef.current)
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

    if (followRef.current && mapRef.current) {
      mapRef.current.panTo([vehicle.lat, vehicle.lng])
    }
  }, [vehicle?.lat, vehicle?.lng, vehicle?.bearing])

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        tilesRef.current = null
      }
    }
  }, [])

  return (
    <div className={`mt-track-map ${className || ''}`.trim()}>
      <div ref={hostRef} className="mt-track-map__canvas" />
    </div>
  )
}
