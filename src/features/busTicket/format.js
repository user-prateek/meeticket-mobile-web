export function placeLabel(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\b([A-Z]{2,})\b/g, (word) => word.charAt(0) + word.slice(1).toLowerCase())
}

export function routeCode(routeName) {
  const raw = String(routeName || '').trim()
  const code = raw.split('-')[0]?.trim()
  return code || 'Bus'
}

export function categoryLabel(category) {
  return String(category || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toUpperCase()
}

export function routeEnds(stops = []) {
  const first = stops[0]
  const last = stops[stops.length - 1]
  return {
    from: placeLabel(first?.stage_name || first?.stop_name || 'Start'),
    to: placeLabel(last?.stage_name || last?.stop_name || 'End'),
  }
}

export function stopTitle(stop) {
  return placeLabel(stop?.stop_name || stop?.stage_name || 'Stop')
}

/** "01 Ticket" / "02 Tickets" */
export function ticketCountLabel(count) {
  const n = Math.max(1, Number(count) || 1)
  const padded = String(n).padStart(2, '0')
  return `${padded} Ticket${n === 1 ? '' : 's'}`
}

export function parseClock(value) {
  const match = String(value || '').match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (!match) return null
  return {
    hours: Number(match[1]),
    minutes: Number(match[2]),
    seconds: Number(match[3] || 0),
  }
}

/** Minutes from `fromClock` to `toClock` on the same service day. */
export function minutesBetweenClocks(fromClock, toClock) {
  const from = parseClock(fromClock)
  const to = parseClock(toClock)
  if (!from || !to) return null
  const start = from.hours * 60 + from.minutes
  const end = to.hours * 60 + to.minutes
  const diff = end - start
  if (diff <= 0) return null
  return diff
}

export function minutesUntilClock(clock, now = new Date()) {
  const parsed = parseClock(clock)
  if (!parsed) return null
  const target = new Date(now)
  target.setHours(parsed.hours, parsed.minutes, parsed.seconds, 0)
  const diff = Math.round((target.getTime() - now.getTime()) / 60000)
  return diff
}

export function todayDateString(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function orderDateTime(date, clock) {
  const parsed = parseClock(clock)
  if (!parsed) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date} ${pad(parsed.hours)}:${pad(parsed.minutes)}:${pad(parsed.seconds)}`
}

export function displayDate(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`
}
