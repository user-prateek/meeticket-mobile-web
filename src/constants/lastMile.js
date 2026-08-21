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
  { id: 'ola', name: 'Ola', logo: olaLogo, accent: '#111111' },
  { id: 'rapido', name: 'Rapido', logo: rapidoLogo, accent: '#f5b400' },
  { id: 'refex', name: 'Refex', logo: refexLogo, accent: '#128c4a' },
]

export const LAST_MILE_PROVIDER_DEFAULT = 'ola'

export const LAST_MILE_MODES = [
  { id: 'cab', label: 'Cab' },
  { id: 'auto', label: 'Auto' },
  { id: 'bike', label: 'Bike' },
]

export const LAST_MILE_MODE_DEFAULT = 'cab'

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

export function getLastMileVehicles(providerId, modeId) {
  const list = LAST_MILE_VEHICLES[providerId] ?? []
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

export function formatFare(fareInr) {
  if (Number.isInteger(fareInr)) return `₹${fareInr}`
  return `₹${fareInr.toFixed(2)}`
}
