const SRC_KEY = 'mt:app-src'
const VERSION_KEY = 'mt:app-version'
const APP_CONTEXT_KEY = 'mt:app-context:v1'

/**
 * WebView bridge params from the host app:
 *   src=android|ios
 *   versionName=1.2.3  (also appversion / appVersion)
 *
 * Captured once from the entry URL into session storage.
 * Not re-appended on in-app navigation — read via getAppContext() / useAppSession().
 */

function firstParam(params, keys) {
  for (const key of keys) {
    const value = params.get(key)
    if (value != null && value !== '') return value
  }
  return null
}

function loadAppContextFromStorage() {
  if (typeof sessionStorage === 'undefined') {
    return { src: '', versionName: '' }
  }
  try {
    const raw = sessionStorage.getItem(APP_CONTEXT_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* fall through */
  }
  return {
    src: sessionStorage.getItem(SRC_KEY) || '',
    versionName: sessionStorage.getItem(VERSION_KEY) || '',
  }
}

function saveAppContext(ctx) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(APP_CONTEXT_KEY, JSON.stringify(ctx))
  if (ctx.src) sessionStorage.setItem(SRC_KEY, ctx.src)
  if (ctx.versionName) sessionStorage.setItem(VERSION_KEY, ctx.versionName)
}

export function captureAppContextFromSearch(search = '') {
  if (typeof sessionStorage === 'undefined') return loadAppContextFromStorage()

  const raw = String(search || '')
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw)
  const src = firstParam(params, ['src'])
  const versionName = firstParam(params, ['versionName', 'versionname', 'appversion', 'appVersion'])

  if (!src && !versionName) return loadAppContextFromStorage()

  const prev = loadAppContextFromStorage()
  const next = {
    src: src || prev.src || '',
    versionName: versionName || prev.versionName || '',
  }
  saveAppContext(next)
  return next
}

export function getAppContext() {
  return loadAppContextFromStorage()
}

/** Pass-through — session params are no longer appended to URLs. */
export function withAppContext(to) {
  return String(to)
}

/** Native close signal — empty page; app intercepts and ends the WebView. */
export const GOTO_HOME_PATH = '/gotohome'
