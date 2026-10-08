import {
  olaOauthAuthorizeUrl,
  olaOauthClientId,
  olaOauthRedirectUri,
  olaOauthScope,
} from '../api/config'
import { getShowCab } from './showCab'

const ATTEMPTED_KEY = 'mt:ola-oauth:attempted'
const RESUME_KEY = 'mt:ola-oauth:resume'
/** Single return slot. `state` is checked separately, not used as the storage key. */
const RETURN_KEY = 'mt:ola-oauth:return'
const PENDING_SAVE_KEY = 'mt:ola-oauth:pending-save'
const STATE_KEY = 'mt:ola-oauth:state'
/** Same document only — lets a strict-mode remount accept the callback it already checked. */
let acceptedCallbackKey = ''

const CALLBACK_QUERY_KEYS = new Set([
  'access_token',
  'ola_access_token',
  'token_type',
  'expires_in',
  'refresh_token',
  'scope',
  'state',
])

function readParams(source) {
  const raw = String(source || '')
  if (!raw) return new URLSearchParams()
  const trimmed = raw.startsWith('#') || raw.startsWith('?') ? raw.slice(1) : raw
  return new URLSearchParams(trimmed)
}

function mergedCallbackParams(location) {
  const merged = readParams(location?.search)
  const hash = readParams(location?.hash)
  for (const [key, value] of hash.entries()) merged.set(key, value)
  return merged
}

export function createOlaOauthState() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

export function rememberOlaOauthState(state) {
  const value = String(state || '').trim()
  if (!value || typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STATE_KEY, value)
  } catch {
    /* quota / private mode */
  }
}

export function peekOlaOauthState() {
  if (typeof localStorage === 'undefined') return ''
  try {
    return String(localStorage.getItem(STATE_KEY) || '').trim()
  } catch {
    return ''
  }
}

export function clearOlaOauthState() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STATE_KEY)
}

/** True when Ola echoed the `state` saved before this authorize redirect. */
export function acceptOlaOauthState(returnedState, accessToken) {
  const actual = String(returnedState || '').trim()
  const token = String(accessToken || '').trim()
  const key = `${actual}:${token}`
  const expected = peekOlaOauthState()
  if (expected && actual && expected === actual) {
    acceptedCallbackKey = key
    clearOlaOauthState()
    return true
  }
  return Boolean(acceptedCallbackKey && acceptedCallbackKey === key)
}

function writeReturnEntry(entry) {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(RETURN_KEY, JSON.stringify(entry))
  } catch {
    /* quota / private mode */
  }
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
  return parseOlaOauthCallback(`?${mergedCallbackParams(location).toString()}`)
}

export function isOlaOauthCallback(location) {
  if (parseOlaOauthFromLocation(location)) return true
  const params = mergedCallbackParams(location)
  return Boolean(
    params.get('scope') ||
      params.get('token_type') ||
      params.get('expires_in') ||
      params.get('state') ||
      params.get('refresh_token'),
  )
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

/** Registered Ola callback — always the whitelist URI, never the live query URL. */
export function resolveOlaRedirectUri() {
  return olaOauthRedirectUri || 'https://mmtsjp.iamgds.com/journey'
}

export function buildOlaAuthorizeUrl({ redirectUri, state } = {}) {
  if (!isOlaOauthConfigured()) return ''
  const oauthState = String(state || '').trim() || createOlaOauthState()
  if (!String(state || '').trim()) rememberOlaOauthState(oauthState)
  const params = new URLSearchParams({
    response_type: 'token',
    client_id: olaOauthClientId,
    redirect_uri: redirectUri || resolveOlaRedirectUri(),
    scope: olaOauthScope || 'profile booking',
    state: oauthState,
  })
  const base = olaOauthAuthorizeUrl.includes('?')
    ? `${olaOauthAuthorizeUrl}&`
    : `${olaOauthAuthorizeUrl}?`
  return `${base}${params.toString()}`
}

export function saveOlaOauthReturn({ url, resume, mobile, showCab } = {}) {
  const path = String(url || '').trim()
  if (!path) return
  writeReturnEntry({
    url: path,
    resume: resume || null,
    mobile: String(mobile || '').trim() || null,
    showCab: Boolean(showCab),
  })
  if (typeof localStorage !== 'undefined') {
    localStorage.removeItem('mt:ola-oauth:returns')
  }
}

/** Read the saved return URL. Does not delete — clear only after a successful restore. */
export function peekOlaOauthReturn() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(RETURN_KEY)
    if (!raw) return null
    const entry = JSON.parse(raw)
    if (!entry || typeof entry !== 'object') return null
    return {
      url: String(entry.url || ''),
      resume: entry.resume || null,
      mobile: String(entry.mobile || '').trim() || null,
      showCab: Boolean(entry.showCab),
    }
  } catch {
    return null
  }
}

export function clearOlaOauthReturn() {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(RETURN_KEY)
  localStorage.removeItem('mt:ola-oauth:returns')
}

export function parseSafeOlaReturnUrl(url) {
  if (typeof window === 'undefined') return null
  const raw = String(url || '').trim()
  if (!raw.startsWith('/') || raw.startsWith('//')) return null
  try {
    const parsed = new URL(raw, window.location.origin)
    if (parsed.origin !== window.location.origin) return null
    const search = parsed.search.startsWith('?') ? parsed.search.slice(1) : parsed.search
    return { pathname: parsed.pathname, search }
  } catch {
    return null
  }
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

export function markOlaOauthAttempted() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(ATTEMPTED_KEY, '1')
}

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
}

function currentReturnPath(extraParams) {
  if (typeof window === 'undefined') return ''
  const page = new URL(window.location.href)
  page.hash = ''
  if (extraParams && typeof extraParams === 'object') {
    for (const [key, value] of Object.entries(extraParams)) {
      if (value == null || value === '') page.searchParams.delete(key)
      else page.searchParams.set(key, String(value))
    }
  }
  return `${page.pathname}${page.search}`
}

/** Navigate this WebView to Ola login; callback returns to redirect_uri with #access_token=. */
export function startOlaOauth({ extraParams, resume, mobile } = {}) {
  if (typeof window === 'undefined' || !isOlaOauthConfigured()) return false
  const resumePayload = resume || peekOlaOauthResume()
  saveOlaOauthReturn({
    url: currentReturnPath(extraParams),
    resume: resumePayload,
    mobile,
    showCab: getShowCab(),
  })
  if (resumePayload) rememberOlaOauthResume(resumePayload)
  markOlaOauthAttempted()
  const state = createOlaOauthState()
  rememberOlaOauthState(state)
  const url = buildOlaAuthorizeUrl({ redirectUri: resolveOlaRedirectUri(), state })
  if (!url) return false
  window.location.assign(url)
  return true
}
