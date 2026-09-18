import { olaAccessToken as envOlaAccessToken } from '../api/config'
import { getUserContext, persistUserPatch } from './userContext'

function isExpired(expiresAt) {
  if (expiresAt == null || expiresAt === '') return false
  const at = Number(expiresAt)
  if (!Number.isFinite(at) || at <= 0) return false
  return Date.now() >= at - 60_000
}

export function readStoredOlaToken(user = getUserContext()) {
  const accessToken = String(user?.olaAccessToken || '').trim()
  if (!accessToken || isExpired(user?.olaTokenExpiresAt)) return ''
  return accessToken
}

/** User OAuth token first, then env fallback used by estimates / orders. */
export function getOlaAccessToken() {
  return readStoredOlaToken() || String(envOlaAccessToken || '').trim()
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
