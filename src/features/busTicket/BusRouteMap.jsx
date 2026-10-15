import { useEffect, useRef } from 'react'
import { GOOGLE_MAPS_API_KEY, loadGoogleMaps } from '../../lib/googleMaps'
import { minutesBetweenClocks } from './format'

function toPath(stops) {
  return (stops || [])
    .map((stop) => ({
      lat: Number(stop.stop_lat),
      lng: Number(stop.stop_lon),
    }))
    .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng))
}

export function BusRouteMap({ stops }) {
  const hostRef = useRef(null)

  useEffect(() => {
    const host = hostRef.current
    const path = toPath(stops)
    if (!host || path.length < 2 || !GOOGLE_MAPS_API_KEY) return undefined
    let map
    let cancelled = false

    loadGoogleMaps()
      .then((gmaps) => {
        if (cancelled || !hostRef.current) return
        map = new gmaps.Map(hostRef.current, {
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        })
        const bounds = new gmaps.LatLngBounds()
        path.forEach((point) => bounds.extend(point))
        new gmaps.Polyline({
          map,
          path,
          strokeColor: '#2f5bff',
          strokeOpacity: 0.95,
          strokeWeight: 5,
        })
        path.forEach((point, index) => {
          const end = index === 0 || index === path.length - 1
          new gmaps.Marker({
            map,
            position: point,
            icon: {
              path: gmaps.SymbolPath.CIRCLE,
              scale: end ? 7 : 4,
              fillColor: end ? '#2eae4f' : '#2f5bff',
              fillOpacity: 1,
              strokeColor: '#ffffff',
              strokeWeight: 2,
            },
          })
        })
        placeTimeBadges(gmaps, map, stops, path)
        map.fitBounds(bounds, 36)
      })
      .catch(() => {})

    return () => {
      cancelled = true
      map = null
    }
  }, [stops])

  return (
    <div className="bt-map">
      <div ref={hostRef} className="bt-map__canvas" />
    </div>
  )
}

function placeTimeBadges(gmaps, map, stops, path) {
  const last = stops.length - 1
  if (last < 1) return
  const mid = Math.max(1, Math.floor(last / 2))
  const marks = [
    { index: Math.max(1, Math.floor(mid / 2)), from: 0, to: mid },
    { index: Math.min(last - 1, mid + Math.floor((last - mid) / 2)), from: mid, to: last },
  ]
  const seen = new Set()
  marks.forEach((mark) => {
    if (seen.has(mark.index) || !path[mark.index]) return
    const mins = minutesBetweenClocks(stops[mark.from]?.departure_time, stops[mark.to]?.arrival_time)
    if (!mins) return
    seen.add(mark.index)
    const text = `${mins} min`
    const width = Math.max(48, text.length * 7 + 14)
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="22"><rect width="${width}" height="22" rx="4" fill="#ffffff"/><text x="${width / 2}" y="15" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#222">${text}</text></svg>`
    new gmaps.Marker({
      map,
      position: path[mark.index],
      icon: {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new gmaps.Size(width, 22),
        anchor: new gmaps.Point(width / 2, 28),
      },
      clickable: false,
    })
  })
}
