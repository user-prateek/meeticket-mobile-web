import { olaTokenMobile } from '../api/olaTokens'
import { isOlaOauthConfigured, rememberOlaOauthResume, startOlaOauth } from './olaOauth'
import { readStoredOlaToken } from './olaToken'
import { getUserContext } from './userContext'

/**
 * User token already in the session atom → caller may hit the products API.
 * Otherwise save the current URL and leave for Ola OAuth.
 */
export async function ensureOlaToken({ extraParams, resume } = {}) {
  if (readStoredOlaToken()) return { ok: true, source: 'session' }
  if (!isOlaOauthConfigured()) return { ok: false, source: 'unconfigured' }

  const mobile = olaTokenMobile(getUserContext()?.mobile)
  if (resume) rememberOlaOauthResume(resume)
  const started = startOlaOauth({ extraParams, resume, mobile })
  return started ? { ok: false, source: 'oauth' } : { ok: false, source: 'unconfigured' }
}
