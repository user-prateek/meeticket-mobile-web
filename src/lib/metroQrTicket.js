import { digitsOnly } from './metroPass'

const TICKET_KEY = 'mt:metro-qr-ticket:v1'

export const METRO_QR_ONEWAY_INR = 150
export const METRO_QR_RETURN_INR = 220

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function metroQrFareInr(ticketType) {
  return ticketType === 'return' ? METRO_QR_RETURN_INR : METRO_QR_ONEWAY_INR
}

export function formatPassDateLong(value) {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function formatMetroTicketIssuedAt(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  const dd = String(date.getDate()).padStart(2, '0')
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const yy = String(date.getFullYear()).slice(-2)
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${dd}-${mm}-${yy}, ${hh}:${mi}`
}

export function formatMetroTicketValidTill(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value)
  date.setHours(23, 59, 0, 0)
  const hr = date.getHours() % 12 || 12
  const min = String(date.getMinutes()).padStart(2, '0')
  const ampm = date.getHours() >= 12 ? 'PM' : 'AM'
  return `${date.getDate()} ${MONTHS[date.getMonth()]} '${String(date.getFullYear()).slice(-2)}, ${hr}:${min} ${ampm}`
}

export function loadMetroQrTicket() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(TICKET_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveMetroQrTicket(ticket) {
  if (typeof sessionStorage === 'undefined') return ticket
  sessionStorage.setItem(TICKET_KEY, JSON.stringify(ticket))
  return ticket
}

export function issueMetroQrTicket({ from, to, ticketType, pax, usedPass }) {
  const now = new Date()
  const fareInr = usedPass ? 0 : metroQrFareInr(ticketType)
  const ticket = {
    refId: String(Math.floor(10 ** 16 + Math.random() * 9 * 10 ** 16)),
    from,
    to,
    fromRole: 'Boarding',
    toRole: 'Alighting',
    tripType: ticketType === 'return' ? 'RETURN' : 'ONEWAY',
    pax: usedPass ? 1 : pax,
    fareInr,
    datetime: formatMetroTicketIssuedAt(now),
    validTill: formatMetroTicketValidTill(now),
    qrPayload: `${from}|${to}|${now.toISOString()}`,
    qrHint: 'Scan this QR at Metro Entry & Exit points',
    platformNo: '',
    durationMin: null,
    usedPass: Boolean(usedPass),
  }
  return saveMetroQrTicket(ticket)
}

export function normalizeOtp(value) {
  return digitsOnly(value).slice(0, 4)
}
