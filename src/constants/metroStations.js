/** Hyderabad Metro Rail stations (Red, Blue, Green). */
export const HYDERABAD_METRO_STATIONS = [
  'Ameerpet',
  'Assembly',
  'Balanagar',
  'Begumpet',
  'Bharat Nagar',
  'Chaitanyapuri',
  'Chikkadpally',
  'Dilsukhnagar',
  'Durgam Cheruvu',
  'Erragadda',
  'ESI Hospital',
  'Gandhi Bhavan',
  'Gandhi Hospital',
  'Habsiguda',
  'Hitec City',
  'Irrum Manzil',
  'JBS Parade Ground',
  'JNTU College',
  'Jubilee Hills Check Post',
  'Khairatabad',
  'KPHB Colony',
  'Kukatpally',
  'Lakdi-ka-Pul',
  'LB Nagar',
  'Madhapur',
  'Madhura Nagar',
  'Malakpet',
  'MG Bus Station',
  'Miyapur',
  'Moosapet',
  'Musarambagh',
  'Musheerabad',
  'Nagole',
  'Nampally',
  'Narayanguda',
  'New Market',
  'NGRI',
  'Osmania Medical College',
  'Parade Ground',
  'Paradise',
  'Peddamma Gudi',
  'Prakash Nagar',
  'Punjagutta',
  'Raidurg',
  'Rasoolpura',
  'Road No 5 Jubilee Hills',
  'RTC X Roads',
  'S.R. Nagar',
  'Secunderabad East',
  'Secunderabad West',
  'Stadium',
  'Sultan Bazar',
  'Tarnaka',
  'Uppal',
  'Victoria Memorial',
  'Yusufguda',
]

export function matchMetroStation(name) {
  const needle = String(name || '')
    .trim()
    .toLowerCase()
  if (!needle) return null
  return (
    HYDERABAD_METRO_STATIONS.find((station) => station.toLowerCase() === needle) ||
    HYDERABAD_METRO_STATIONS.find((station) => needle.includes(station.toLowerCase())) ||
    HYDERABAD_METRO_STATIONS.find((station) => station.toLowerCase().includes(needle)) ||
    null
  )
}
