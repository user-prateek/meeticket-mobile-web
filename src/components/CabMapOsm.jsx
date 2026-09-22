import { useEffect, useRef, useState } from 'react'
import olaGoAc from '../assets/vehicles/ola_go_ac.png'
import {
  haversineKm,
  reverseGeocodeShortName,
} from '../lib/geocode'
import { mountLeafletHtmlMarker } from '../lib/leafletHtmlMarker'
import {
  fetchOsmDrivingRoute,
  loadLeaflet,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
} from '../lib/osmMaps'
import { InlineSpinner } from './InlineSpinner'
import { DropMarker } from './map/DropMarker'
import { PickupMarker } from './map/PickupMarker'
import { SearchPulseMarker } from './map/SearchPulseMarker'
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

/**
 * OpenStreetMap cab map: Leaflet tiles + OSRM driving path + HTML pickup/drop markers.
 */
export function CabMapOsm({ from, to, className, vehicleSrc, distance, searching = false }) {
  const hostRef = useRef(null)
  const mapRef = useRef(null)
  const tilesRef = useRef(null)
  const overlaysRef = useRef([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')

  const vehicle = vehicleSrc || olaGoAc

  useEffect(() => {
    if (!from || !to || !hostRef.current) return undefined

    let cancelled = false

    function clearOverlays() {
      overlaysRef.current.forEach((item) => {
        if (item?.clear) item.clear()
        else if (item?.remove) item.remove()
      })
      overlaysRef.current = []
    }

    setStatus('loading')
    setError('')

    loadLeaflet()
      .then(async (L) => {
        if (cancelled || !hostRef.current) return

        clearOverlays()

        const origin = { lat: from.lat, lng: from.lng }
        const destination = { lat: to.lat, lng: to.lng }

        if (!mapRef.current) {
          mapRef.current = L.map(hostRef.current, {
            center: [origin.lat, origin.lng],
            zoom: 15,
            zoomControl: true,
            attributionControl: true,
          })
          tilesRef.current = L.tileLayer(OSM_TILE_URL, {
            attribution: OSM_ATTRIBUTION,
            maxZoom: 19,
          }).addTo(mapRef.current)
        }

        const map = mapRef.current
        requestAnimationFrame(() => map.invalidateSize())

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

        const pickup = mountLeafletHtmlMarker({
          L,
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
        const drop = mountLeafletHtmlMarker({
          L,
          map,
          position: destination,
          zIndex: 1,
          node: <DropMarker placeName={dropName} />,
        })
        overlaysRef.current.push(pickup, drop)

        if (searching) {
          overlaysRef.current.push(
            mountLeafletHtmlMarker({
              L,
              map,
              position: origin,
              zIndex: 0,
              node: <SearchPulseMarker />,
            }),
          )
        }

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

        try {
          const route = await fetchOsmDrivingRoute({
            fromLat: origin.lat,
            fromLng: origin.lng,
            toLat: destination.lat,
            toLng: destination.lng,
          })
          if (cancelled) return

          const line = L.polyline(
            route.path.map((p) => [p.lat, p.lng]),
            { color: '#000000', weight: 6, opacity: 1 },
          ).addTo(map)
          overlaysRef.current.push(line)
          map.fitBounds(line.getBounds(), {
            paddingTopLeft: [48, 48],
            paddingBottomRight: [140, 56],
          })
          if (!parsed && Number.isFinite(route.distanceM) && route.distanceM > 0) {
            badge = formatKm(route.distanceM / 1000)
          }
          paintMarkers()
          setStatus('ready')
          setError('')
        } catch (routeError) {
          if (cancelled) return
          const bounds = L.latLngBounds(
            [origin.lat, origin.lng],
            [destination.lat, destination.lng],
          )
          map.fitBounds(bounds, { padding: [64, 64] })
          setStatus('error')
          setError(routeError?.message || 'Driving route failed.')
        }
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
  }, [from?.lat, from?.lng, from?.label, to?.lat, to?.lng, to?.label, vehicle, distance, searching])

  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        tilesRef.current = null
      }
    }
  }, [])

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
      {status === 'loading' ? (
        <div className="mt-cab-map__loading">
          <InlineSpinner size={28} label="Loading map" />
        </div>
      ) : null}
      {error ? <p className="mt-cab-map__error">{error}</p> : null}
    </div>
  )
}
