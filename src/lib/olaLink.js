import { fetchOlaAccessToken, olaTokenMobile } from '../api/olaTokens'
import { isOlaOauthConfigured, rememberOlaOauthResume, startOlaOauth } from './olaOauth'
import { readStoredOlaToken, storeOlaAccessToken } from './olaToken'
import { getUserContext } from './userContext'

/**
 * Resolve an Ola user token for the current session.
 * Session / GET reuse first; otherwise open Ola authorize. Callback is registered `/journey`;
 * the real page URL is restored from localStorage, then that key is removed.
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
  startOlaOauth({ extraParams, resume, mobile })
  return { ok: false, source: 'oauth' }
}
