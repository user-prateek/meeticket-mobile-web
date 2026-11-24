import { createRoot } from 'react-dom/client'
import { osmDivIcon } from './osmMaps'

/**
 * Leaflet marker whose icon is a React tree (same HTML markers as Google AdvancedMarker).
 */
export function mountLeafletHtmlMarker({
  L,
  map,
  position,
  zIndex = 0,
  node,
  className = 'mt-map-marker-host',
  interactive = false,
  onClick,
}) {
  const host = document.createElement('div')
  host.className = className
  const root = createRoot(host)
  root.render(node)

  const marker = L.marker([position.lat, position.lng], {
    icon: osmDivIcon(L, host, className),
    zIndexOffset: zIndex,
    interactive,
    keyboard: interactive,
  }).addTo(map)

  if (onClick) marker.on('click', onClick)

  return {
    setPosition(next) {
      marker.setLatLng([next.lat, next.lng])
    },
    update(nextNode) {
      root.render(nextNode)
    },
    clear() {
      try {
        map.removeLayer(marker)
      } catch {
        /* map already removed */
      }
      // Leaflet overlay cleanup can run while React is rendering (Strict Mode / GPS ticks).
      queueMicrotask(() => {
        try {
          root.unmount()
        } catch {
          /* already unmounted */
        }
      })
    },
  }
}
