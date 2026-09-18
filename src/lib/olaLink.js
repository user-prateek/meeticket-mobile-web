import { fetchOlaAccessToken, olaTokenMobile } from '../api/olaTokens'
import { isOlaOauthConfigured, rememberOlaOauthResume, startOlaOauth } from './olaOauth'
import { readStoredOlaToken, storeOlaAccessToken } from './olaToken'
import { getUserContext } from './userContext'

/**
 * Resolve an Ola user token for the current session.
 * Session / GET reuse first; otherwise open Ola authorize with the current page as callback.
 */
export async function ensureOlaToken({ extraParams, resume } = {}) {
  if (readStoredOlaToken()) return { ok: true, source: 'session' }

  const mobile = olaTokenMobile(getUserContext()?.mobile)
  if (mobile) {
    try {
      const stored = await fetchOlaAccessToken(mobile)
      if (stored?.accessToken) {
        storeOlaAccessToken(stored)
        return { ok: true, source: 'api' }
      }
    } catch {
      // Lookup failed — fall through to OAuth when configured.
    }
  }

  if (!isOlaOauthConfigured()) return { ok: false, source: 'unconfigured' }

  if (resume) rememberOlaOauthResume(resume)
  startOlaOauth({ extraParams })
  return { ok: false, source: 'oauth' }
}
