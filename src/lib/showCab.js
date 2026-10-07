/**
 * First-mile cab is off by default (production).
 * `/journey?sc=1` turns it on for this session; later pages keep that choice.
 * A new `/journey` entry with trip coords and no `sc=1` turns it off again.
 */

import { hasRequiredTripParams } from './tripQuery'

const SHOW_CAB_KEY = 'mt:show-cab'

function searchParamsFrom(source) {
  if (source instanceof URLSearchParams) return source
  return new URLSearchParams(source ?? '')
}

function writeShowCab(on) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(SHOW_CAB_KEY, on ? '1' : '0')
}

export function getShowCab() {
  if (typeof sessionStorage === 'undefined') return false
  return sessionStorage.getItem(SHOW_CAB_KEY) === '1'
}

export function persistShowCab(on) {
  writeShowCab(Boolean(on))
  return Boolean(on)
}

export function captureShowCabFromSearch(pathname, search) {
  if (pathname !== '/journey') return getShowCab()

  const params = searchParamsFrom(search)
  const raw = String(params.get('sc') || params.get('show_cab') || params.get('showcab') || '').trim()
  if (raw === '1') return persistShowCab(true)

  // Bare /journey (Ola callback) must not clear a session already turned on.
  if (!hasRequiredTripParams(search)) return getShowCab()

  return persistShowCab(false)
}
