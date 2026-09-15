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

/** Map pin icon for the booked ride type — never default to bike. */
export function mapVehicleIconForMode(mode) {
  const key = String(mode || '').toLowerCase()
  if (key === 'auto') return olaAuto
  if (key === 'bike') return olaBike
  return olaGoAc
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

function liveOrCatalogVehicles(providerId, liveVehicles) {
  if (providerId === 'ola' || providerId === 'refex') {
    return Array.isArray(liveVehicles) ? liveVehicles : []
  }
  return LAST_MILE_VEHICLES[providerId] ?? []
}

function firstInMode(vehicles) {
  return vehicles.find((vehicle) => !vehicle?.unavailable) || vehicles[0] || null
}

/** Route card — one cheapest option per mode (auto, cab, bike). */
export function getProviderCardSlots(providerId, liveVehicles) {
  // Ola / Refex always use live API results (never static mocks once selected).
  const list = liveOrCatalogVehicles(providerId, liveVehicles)
  const modes = providerId === 'refex' ? ['cab'] : CARD_MODE_ORDER

  return CARD_MODE_ORDER.map((mode) => {
    if (!modes.includes(mode)) return null
    return cheapestInMode(list.filter((vehicle) => vehicle.mode === mode))
  })
}

/** Journey detail — first available category per mode. Missing modes stay null. */
export function getFirstCategorySlots(providerId, liveVehicles) {
  const list = liveOrCatalogVehicles(providerId, liveVehicles)
  const modes = providerId === 'refex' ? ['cab'] : CARD_MODE_ORDER

  return CARD_MODE_ORDER.map((mode) => {
    if (!modes.includes(mode)) return null
    return firstInMode(list.filter((vehicle) => vehicle.mode === mode))
  })
}

/**
 * Journey detail — one summary card per mode (cab / auto), not per Ola category.
 * Category-level fares live on the Cab page; here we only show min–max fare + time
 * and a few popular category names (e.g. Mini · SUV · Share).
 */
const DETAIL_MODE_ORDER = ['cab', 'auto']

/** Prefer these Ola category ids when picking 2–3 names for the cab summary. */
const CAB_HIGHLIGHT_CATEGORY_IDS = ['mini', 'suv', 'share', 'micro', 'prime', 'prime_play']

function pickHighlightLabels(vehicles, mode) {
  if (mode === 'auto') {
    const labels = vehicles.map((v) => v.label).filter(Boolean)
    return [...new Set(labels)].slice(0, 2)
  }
  if (mode !== 'cab') return []

  const byCategory = new Map()
  for (const vehicle of vehicles) {
    const id = String(vehicle.categoryId || vehicle.id || '')
      .replace(/^ola_/, '')
      .toLowerCase()
    if (!id || byCategory.has(id)) continue
    byCategory.set(id, vehicle.label || id)
  }

  const picked = []
  for (const id of CAB_HIGHLIGHT_CATEGORY_IDS) {
    if (!byCategory.has(id)) continue
    picked.push(byCategory.get(id))
    byCategory.delete(id)
    if (picked.length >= 3) break
  }
  if (picked.length < 2) {
    for (const label of byCategory.values()) {
      picked.push(label)
      if (picked.length >= 3) break
    }
  }
  return picked
}

function formatSummaryTime(minMin, maxMin) {
  if (minMin == null && maxMin == null) return null
  if (minMin != null && maxMin != null && minMin !== maxMin) {
    return `${minMin} – ${maxMin} Min`
  }
  const only = minMin ?? maxMin
  return only != null ? `${only} Min` : null
}

/**
 * @param {string} providerId
 * @param {object[] | undefined} liveVehicles
 * @returns {object[]} mode summary cards for journey detail
 */
export function summarizeProviderModes(providerId, liveVehicles) {
  const list =
    providerId === 'ola' || providerId === 'refex'
      ? Array.isArray(liveVehicles)
        ? liveVehicles
        : []
      : LAST_MILE_VEHICLES[providerId] ?? []

  const available = list.filter((vehicle) => vehicle && !vehicle.unavailable)
  const modes = providerId === 'refex' ? ['cab'] : DETAIL_MODE_ORDER

  return modes
    .map((mode) => {
      const group = available.filter((vehicle) => vehicle.mode === mode)
      if (!group.length) return null

      const fareLows = group.map((v) => Number(v.fareInr)).filter(Number.isFinite)
      const fareHighs = group
        .map((v) => Number(v.fareMaxInr != null ? v.fareMaxInr : v.fareInr))
        .filter(Number.isFinite)
      const times = group
        .map((v) => Number(v.travelTimeMin != null ? v.travelTimeMin : v.etaMin))
        .filter(Number.isFinite)

      if (!fareLows.length) return null

      const low = Math.round(Math.min(...fareLows))
      const high = Math.round(Math.max(...fareHighs.length ? fareHighs : fareLows))
      const tLow = times.length ? Math.round(Math.min(...times)) : null
      const tHigh = times.length ? Math.round(Math.max(...times)) : null
      const highlights = pickHighlightLabels(group, mode)
      const modeLabel = getLastMileMode(mode)?.label || mode
      const label = highlights.length ? highlights.join(' · ') : modeLabel
      const cheapest = cheapestInMode(group)

      return {
        id: `${providerId}_${mode}_summary`,
        mode,
        label,
        modeLabel,
        icon: cheapest?.icon || null,
        fareInr: low,
        fareMaxInr: high !== low ? high : null,
        fareDisplay: high !== low ? `${formatFare(low)} – ${formatFare(high)}` : formatFare(low),
        travelTimeMin: tLow,
        travelTimeMax: tHigh,
        timeDisplay: formatSummaryTime(tLow, tHigh),
        etaMin: tLow,
        providerId,
        isModeSummary: true,
        peak: group.some((v) => v.peak),
        payAtPickup: group.every((v) => v.payAtPickup || v.providerId === 'ola' || providerId === 'ola'),
        includeInOnlineTotal: providerId === 'ola' ? false : cheapest?.includeInOnlineTotal,
        categoryCount: group.length,
        representativeId: cheapest?.id || null,
        unavailable: false,
      }
    })
    .filter(Boolean)
}

/** @deprecated Prefer summarizeProviderModes for journey detail. */
export function getProviderDetailOptions(providerId, liveVehicles) {
  return summarizeProviderModes(providerId, liveVehicles)
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

/** ETA label for provider slots — never shows negative ETA. Prefer trip time when ETA unknown. */
export function formatVehicleEta(vehicle) {
  if (!vehicle) return null
  if (vehicle.unavailable) return 'Unavailable'
  if (vehicle.etaMin != null) return `${vehicle.etaMin} Min`
  if (vehicle.travelTimeMin != null) return `${vehicle.travelTimeMin} Min`
  return null
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
