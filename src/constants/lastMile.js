import olaPremierAc from '../assets/vehicles/ola_premier_ac.png'
import olaXl from '../assets/vehicles/ola_xl.png'
import olaGoAc from '../assets/vehicles/ola_go_ac.png'
import olaBike from '../assets/vehicles/ola_bike.png'
import olaAuto from '../assets/vehicles/ola_auto.png'
import rapidoCabXl from '../assets/vehicles/rapido_cab_xl.png'
import rapidoCabEconomy from '../assets/vehicles/rapido_cab_economy.png'
import rapidoCabPremium from '../assets/vehicles/rapido_cab_premium.png'
import rapidoScooty from '../assets/vehicles/rapido_scooty.png'
import rapidoBike from '../assets/vehicles/rapido_bike.png'
import rapidoBikeLite from '../assets/vehicles/rapido_bike_lite.png'
import rapidoAuto from '../assets/vehicles/rapido_auto.png'
import rapidoAutoPriority from '../assets/vehicles/rapido_auto_priority.png'
import olaLogo from '../assets/brands/ola.png'
import rapidoLogo from '../assets/brands/rapido.png'
import refexLogo from '../assets/brands/refex.png'

export const LAST_MILE_PROVIDERS = [
  { id: 'ola', name: 'Ola', logo: olaLogo, accent: '#111111', enabled: true },
  { id: 'rapido', name: 'Rapido', logo: rapidoLogo, accent: '#f5b400', enabled: false },
  { id: 'refex', name: 'Refex', logo: refexLogo, accent: '#128c4a', enabled: true },
]

/** Ola / Rapido not integrated yet — only Refex is live. */
export const LAST_MILE_PROVIDER_DEFAULT = 'refex'

export const LAST_MILE_MODES = [
  { id: 'cab', label: 'Cab' },
  { id: 'auto', label: 'Auto' },
  { id: 'bike', label: 'Bike' },
]

export const LAST_MILE_MODE_DEFAULT = 'cab'

/** Refex corporate cab — cab only. */
export const REFEX_SUPPORTED_MODES = ['cab']

export function isProviderEnabled(providerId) {
  if (!providerId) return false
  const provider = LAST_MILE_PROVIDERS.find((item) => item.id === providerId)
  return Boolean(provider?.enabled)
}

/** Providers that can be selected (integrated). Catalog still lists disabled ones in UI. */
export function getEnabledLastMileProviders() {
  return LAST_MILE_PROVIDERS.filter((provider) => provider.enabled)
}

/** Keep only integrated providers; otherwise return fallback (default null). */
export function coerceEnabledProviderId(providerId, { fallback = null } = {}) {
  if (isProviderEnabled(providerId)) return providerId
  return fallback
}

export function providerSupportsMode(providerId, modeId) {
  if (!isProviderEnabled(providerId)) return false
  if (providerId === 'refex') return modeId === 'cab'
  return true
}

export function isProviderDisabledForMode(providerId, modeId) {
  return !providerSupportsMode(providerId, modeId)
}

/** Tooltip / title when a provider tile cannot be selected. */
export function providerDisabledReason(providerId, modeId) {
  if (!isProviderEnabled(providerId)) {
    return `${getLastMileProvider(providerId)?.name || 'This provider'} is coming soon`
  }
  if (providerId === 'refex' && modeId && modeId !== 'cab') {
    return 'Refex is available for cab only'
  }
  return undefined
}

/**
 * Vehicle options keyed by provider.
 * Icons: src/assets/vehicles/
 */
export const LAST_MILE_VEHICLES = {
  ola: [
    {
      id: 'ola_go_ac',
      label: 'Ola Go AC',
      mode: 'cab',
      icon: olaGoAc,
      fareInr: 459.93,
      etaMin: 2,
      dropTime: '4:44 pm',
      faster: true,
    },
    {
      id: 'ola_bike',
      label: 'Bike Saver',
      mode: 'bike',
      icon: olaBike,
      fareInr: 210.63,
      etaMin: 3,
      dropTime: '4:45 pm',
    },
    {
      id: 'ola_xl',
      label: 'Ola XL',
      mode: 'cab',
      icon: olaXl,
      fareInr: 508.12,
      etaMin: 4,
      dropTime: '4:46 pm',
    },
    {
      id: 'ola_auto',
      label: 'Auto',
      mode: 'auto',
      icon: olaAuto,
      fareInr: 319.69,
      etaMin: 3,
      dropTime: '4:45 pm',
      subtitle: 'Hassle-free Auto rides',
    },
    {
      id: 'ola_premier_ac',
      label: 'Premier AC',
      mode: 'cab',
      icon: olaPremierAc,
      fareInr: 550.88,
      etaMin: 5,
      dropTime: '4:47 pm',
    },
  ],
  rapido: [
    {
      id: 'rapido_cab_economy',
      label: 'Cab Economy',
      mode: 'cab',
      icon: rapidoCabEconomy,
      fareInr: 194,
      etaMin: 2,
      dropTime: '4:44 pm',
      faster: true,
    },
    {
      id: 'rapido_cab_premium',
      label: 'Cab Premium',
      mode: 'cab',
      icon: rapidoCabPremium,
      fareInr: 296,
      etaMin: 3,
      dropTime: '4:45 pm',
    },
    {
      id: 'rapido_cab_xl',
      label: 'Cab XL',
      mode: 'cab',
      icon: rapidoCabXl,
      fareInr: 410,
      etaMin: 4,
      dropTime: '4:46 pm',
    },
    {
      id: 'rapido_auto',
      label: 'Auto',
      mode: 'auto',
      icon: rapidoAuto,
      fareInr: 71,
      subtitle: 'Hassle-free Auto rides',
    },
    {
      id: 'rapido_auto_priority',
      label: 'Auto Priority',
      mode: 'auto',
      icon: rapidoAutoPriority,
      fareInr: 117,
      etaMin: 2,
      dropTime: '4:43 pm',
      faster: true,
    },
    {
      id: 'rapido_bike_lite',
      label: 'Bike Lite',
      mode: 'bike',
      icon: rapidoBikeLite,
      fareInr: 71,
      etaMin: 2,
      dropTime: '4:43 pm',
      faster: true,
    },
    {
      id: 'rapido_bike',
      label: 'Bike',
      mode: 'bike',
      icon: rapidoBike,
      fareInr: 84,
      etaMin: 3,
      dropTime: '4:44 pm',
    },
    {
      id: 'rapido_scooty',
      label: 'Scooty',
      mode: 'bike',
      icon: rapidoScooty,
      fareInr: 101,
      etaMin: 3,
      dropTime: '4:45 pm',
    },
  ],
  refex: [],
}

export const CARD_MODE_ORDER = ['auto', 'cab', 'bike']

function cheapestInMode(vehicles) {
  if (!vehicles.length) return null
  return vehicles.reduce((best, vehicle) => {
    const fare = Number(vehicle.fareInr)
    const bestFare = Number(best.fareInr)
    if (!Number.isFinite(fare)) return best
    if (!Number.isFinite(bestFare)) return vehicle
    return fare < bestFare ? vehicle : best
  })
}

/** Route card — one cheapest option per mode (auto, cab, bike). */
export function getProviderCardSlots(providerId, liveVehicles) {
  // Ola / Refex always use live API results (never static mocks once selected).
  const list =
    providerId === 'ola' || providerId === 'refex'
      ? Array.isArray(liveVehicles)
        ? liveVehicles
        : []
      : LAST_MILE_VEHICLES[providerId] ?? []
  const modes = providerId === 'refex' ? ['cab'] : CARD_MODE_ORDER

  return CARD_MODE_ORDER.map((mode) => {
    if (!modes.includes(mode)) return null
    return cheapestInMode(list.filter((vehicle) => vehicle.mode === mode))
  })
}

export function getLastMileVehicles(providerId, modeId, liveVehicles) {
  const list =
    providerId === 'ola' || providerId === 'refex'
      ? Array.isArray(liveVehicles)
        ? liveVehicles
        : []
      : LAST_MILE_VEHICLES[providerId] ?? []
  if (!modeId) return list
  return list.filter((vehicle) => vehicle.mode === modeId)
}

export function getLastMileModes(providerId) {
  const list = LAST_MILE_VEHICLES[providerId] ?? []
  const present = new Set(list.map((vehicle) => vehicle.mode))
  return LAST_MILE_MODES.filter((mode) => present.has(mode.id))
}

export function getLastMileProvider(providerId) {
  return LAST_MILE_PROVIDERS.find((provider) => provider.id === providerId)
}

export function getLastMileMode(modeId) {
  return LAST_MILE_MODES.find((mode) => mode.id === modeId)
}

export function findLastMileVehicle(providerId, vehicleId) {
  if (!providerId || !vehicleId) return null
  return (LAST_MILE_VEHICLES[providerId] ?? []).find((vehicle) => vehicle.id === vehicleId) ?? null
}

export function formatFare(fareInr) {
  if (fareInr == null || fareInr === '') return ''
  if (Number.isInteger(fareInr)) return `₹${fareInr}`
  return `₹${Number(fareInr).toFixed(2)}`
}

/** Prefer preformatted range label when present (Ola amount_min – amount_max). */
export function formatVehicleFare(vehicle) {
  if (!vehicle) return ''
  if (vehicle.fareDisplay) return vehicle.fareDisplay
  if (vehicle.fareMaxInr != null && vehicle.fareInr != null && vehicle.fareMaxInr !== vehicle.fareInr) {
    return `${formatFare(vehicle.fareInr)} – ${formatFare(vehicle.fareMaxInr)}`
  }
  return formatFare(vehicle.fareInr)
}

/** Ola (and similar) are cash / pay-at-pickup — not charged via Paytm. */
export function isPayAtPickupVehicle(vehicle) {
  if (!vehicle) return false
  if (vehicle.payAtPickup || vehicle.includeInOnlineTotal === false) return true
  return vehicle.providerId === 'ola'
}

/** Fare amount that should be collected online (excludes cash last-mile). */
export function onlineFareInrFromVehicle(vehicle) {
  if (!vehicle || isPayAtPickupVehicle(vehicle)) return 0
  const fare = Number(vehicle.fareInr)
  return Number.isFinite(fare) ? fare : 0
}

/** ETA label for provider slots — never shows negative ETA. */
export function formatVehicleEta(vehicle) {
  if (!vehicle) return null
  if (vehicle.unavailable) return 'Unavailable'
  if (vehicle.etaMin == null) return null
  return `${vehicle.etaMin} Min`
}

/** Secondary line under vehicle name (trip time, peak, etc.). */
export function formatVehicleMeta(vehicle) {
  if (!vehicle) return ''
  if (vehicle.subtitle) return vehicle.subtitle
  const parts = []
  if (vehicle.dropTime) parts.push(vehicle.dropTime)
  if (vehicle.etaMin != null && !vehicle.unavailable) parts.push(`${vehicle.etaMin} min`)
  return parts.join(' · ')
}
