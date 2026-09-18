import {
  olaOauthAuthorizeUrl,
  olaOauthClientId,
  olaOauthRedirectUri,
  olaOauthScope,
} from '../api/config'

const STATE_KEY = 'mt:ola-oauth:state'
const RETURN_KEY = 'mt:ola-oauth:return'
const ATTEMPTED_KEY = 'mt:ola-oauth:attempted'
const RESUME_KEY = 'mt:ola-oauth:resume'

const CALLBACK_QUERY_KEYS = new Set([
  'access_token',
  'ola_access_token',
  'token_type',
  'expires_in',
  'refresh_token',
  'scope',
])

function randomState() {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function readParams(source) {
  const raw = String(source || '')
  if (!raw) return new URLSearchParams()
  const trimmed = raw.startsWith('#') || raw.startsWith('?') ? raw.slice(1) : raw
  return new URLSearchParams(trimmed)
}

export function isOlaOauthConfigured() {
  return Boolean(olaOauthAuthorizeUrl && olaOauthClientId)
}

export function parseOlaOauthCallback(source) {
  const params = readParams(source)
  const accessToken = String(
    params.get('access_token') || params.get('ola_access_token') || '',
  ).trim()
  if (!accessToken) return null

  const expiresIn = Number(params.get('expires_in'))
  const expiresAt =
    Number.isFinite(expiresIn) && expiresIn > 0 ? Date.now() + expiresIn * 1000 : null

  return {
    accessToken,
    tokenType: String(params.get('token_type') || '').trim() || null,
    expiresIn: Number.isFinite(expiresIn) ? expiresIn : null,
    expiresAt,
    state: String(params.get('state') || '').trim() || null,
    scope: String(params.get('scope') || '').trim() || null,
  }
}

export function parseOlaOauthFromLocation(location) {
  return parseOlaOauthCallback(location?.hash) || parseOlaOauthCallback(location?.search)
}

export function stripOlaOauthSearch(search = '') {
  const raw = String(search || '')
  const params = new URLSearchParams(raw.startsWith('?') ? raw.slice(1) : raw)
  let changed = false
  for (const key of [...params.keys()]) {
    if (CALLBACK_QUERY_KEYS.has(String(key).toLowerCase())) {
      params.delete(key)
      changed = true
    }
  }
  if (!changed) return raw.startsWith('?') ? raw.slice(1) : raw
  return params.toString()
}

export function currentPageUrl() {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${window.location.pathname}${window.location.search}`
}

export function resolveOlaRedirectUri() {
  return olaOauthRedirectUri || currentPageUrl()
}

export function buildOlaAuthorizeUrl({ redirectUri, state } = {}) {
  if (!isOlaOauthConfigured()) return ''
  const params = new URLSearchParams({
    response_type: 'token',
    client_id: olaOauthClientId,
    redirect_uri: redirectUri || resolveOlaRedirectUri(),
    scope: olaOauthScope || 'profile booking',
    state: state || randomState(),
  })
  const base = olaOauthAuthorizeUrl.includes('?')
    ? `${olaOauthAuthorizeUrl}&`
    : `${olaOauthAuthorizeUrl}?`
  return `${base}${params.toString()}`
}

export function rememberOlaOauthReturn(pathWithSearch) {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(RETURN_KEY, pathWithSearch || `${window.location.pathname}${window.location.search}`)
  sessionStorage.setItem(STATE_KEY, sessionStorage.getItem(STATE_KEY) || randomState())
}

export function rememberOlaOauthResume(resume) {
  if (typeof sessionStorage === 'undefined' || !resume) return
  sessionStorage.setItem(RESUME_KEY, JSON.stringify(resume))
}

export function peekOlaOauthResume() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(RESUME_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function takeOlaOauthResume() {
  const value = peekOlaOauthResume()
  if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(RESUME_KEY)
  return value
}

export function takeOlaOauthReturn() {
  if (typeof sessionStorage === 'undefined') return ''
  const value = sessionStorage.getItem(RETURN_KEY) || ''
  sessionStorage.removeItem(RETURN_KEY)
  return value
}

export function peekOlaOauthState() {
  if (typeof sessionStorage === 'undefined') return ''
  return sessionStorage.getItem(STATE_KEY) || ''
}

export function markOlaOauthAttempted() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(ATTEMPTED_KEY, '1')
}

const PENDING_SAVE_KEY = 'mt:ola-oauth:pending-save'

export function markOlaOauthPendingSave() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(PENDING_SAVE_KEY, '1')
}

export function takeOlaOauthPendingSave() {
  if (typeof sessionStorage === 'undefined') return false
  const pending = sessionStorage.getItem(PENDING_SAVE_KEY) === '1'
  if (pending) sessionStorage.removeItem(PENDING_SAVE_KEY)
  return pending
}

export function hasOlaOauthAttempted() {
  if (typeof sessionStorage === 'undefined') return false
  return sessionStorage.getItem(ATTEMPTED_KEY) === '1'
}

export function clearOlaOauthAttempt() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.removeItem(ATTEMPTED_KEY)
  sessionStorage.removeItem(STATE_KEY)
}

function pageUrlWithParams(extraParams) {
  if (typeof window === 'undefined') return ''
  const page = new URL(window.location.href)
  page.hash = ''
  if (extraParams && typeof extraParams === 'object') {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value == null || value === '') page.searchParams.delete(key)
      else page.searchParams.set(key, String(value))
    }
  }
  return `${page.origin}${page.pathname}${page.search}`
}

/** Navigate this WebView to Ola login; callback returns to redirect_uri with #access_token=. */
export function startOlaOauth({ extraParams } = {}) {
  if (typeof window === 'undefined' || !isOlaOauthConfigured()) return false
  const state = randomState()
  const currentUrl = pageUrlWithParams(extraParams)
  const redirectUri = olaOauthRedirectUri || currentUrl
  sessionStorage.setItem(STATE_KEY, state)
  rememberOlaOauthReturn(`${window.location.pathname}${window.location.search}`)
  markOlaOauthAttempted()
  const url = buildOlaAuthorizeUrl({ redirectUri, state })
  if (!url) return false
  window.location.assign(url)
  return true
}
