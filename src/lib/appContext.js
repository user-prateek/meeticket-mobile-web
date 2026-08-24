const SRC_KEY = 'mt:app-src'
const VERSION_KEY = 'mt:app-version'

/**
 * WebView bridge params from the host app:
 *   src=android|ios
 *   versionName=1.2.3
 *
 * Captured once from the entry URL and appended on every in-app navigation
 * so the server / native URL tracker always sees platform + app version.
 */

export function captureAppContextFromSearch(search = '') {
  if (typeof sessionStorage === 'undefined') return
  const raw = String(search || '')
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw)
  const src = params.get('src')
  const versionName = params.get('versionName')
  if (src) sessionStorage.setItem(SRC_KEY, src)
  if (versionName) sessionStorage.setItem(VERSION_KEY, versionName)
}

export function getAppContext() {
  if (typeof sessionStorage === 'undefined') {
    return { src: '', versionName: '' }
  }
  return {
    src: sessionStorage.getItem(SRC_KEY) || '',
    versionName: sessionStorage.getItem(VERSION_KEY) || '',
  }
}

/** Append src + versionName to a path like `/cab?id=1` or `/journey?...`. */
export function withAppContext(to) {
  const ctx = getAppContext()
  if (!ctx.src && !ctx.versionName) return String(to)

  const full = String(to)
  const hashIndex = full.indexOf('#')
  const hash = hashIndex >= 0 ? full.slice(hashIndex) : ''
  const withoutHash = hashIndex >= 0 ? full.slice(0, hashIndex) : full
  const qIndex = withoutHash.indexOf('?')
  const pathname = qIndex >= 0 ? withoutHash.slice(0, qIndex) : withoutHash
  const query = qIndex >= 0 ? withoutHash.slice(qIndex + 1) : ''
  const params = new URLSearchParams(query)

  if (ctx.src) params.set('src', ctx.src)
  if (ctx.versionName) params.set('versionName', ctx.versionName)

  const q = params.toString()
  return `${pathname}${q ? `?${q}` : ''}${hash}`
}

/** Native close signal — empty page; app intercepts and ends the WebView. */
export const GOTO_HOME_PATH = '/gotohome'
