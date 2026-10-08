import { OLA_USER_TOKEN_KEY } from '../store/journey'
import { getUserContext, persistUserPatch } from './userContext'

function isExpired(expiresAt) {
  if (expiresAt == null || expiresAt === '') return false
  const at = Number(expiresAt)
  if (!Number.isFinite(at) || at <= 0) return false
  return Date.now() >= at - 60_000
}

export function usableOlaAccessToken(value) {
  const accessToken = String(value?.accessToken || '').trim()
  if (!accessToken || isExpired(value?.expiresAt)) return ''
  return accessToken
}

function readPersistedOlaUserToken() {
  if (typeof sessionStorage === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(OLA_USER_TOKEN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed
  } catch {
    return null
  }
}

export function readStoredOlaToken(user = getUserContext()) {
  const persisted = usableOlaAccessToken(readPersistedOlaUserToken())
  if (persisted) return persisted
  const accessToken = String(user?.olaAccessToken || '').trim()
  if (!accessToken || isExpired(user?.olaTokenExpiresAt)) return ''
  return accessToken
}

/** User Ola bearer from the session atom. x-app-token is VITE_OLA_CLIENT_ID. */
export function getOlaAccessToken() {
  return readStoredOlaToken()
}

export function storeOlaAccessToken({ accessToken, expiresAt, expiresIn } = {}) {
  const token = String(accessToken || '').trim()
  if (!token) return getUserContext()
  const resolvedExpiresAt =
    expiresAt ??
    (Number(expiresIn) > 0 ? Date.now() + Number(expiresIn) * 1000 : undefined)
  return persistUserPatch({
    olaAccessToken: token,
    olaTokenExpiresAt: resolvedExpiresAt ?? null,
    olaExpiresIn: Number(expiresIn) > 0 ? Number(expiresIn) : null,
  })
}

export function hasUsableOlaUserToken() {
  return Boolean(readStoredOlaToken())
}
