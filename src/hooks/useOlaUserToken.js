import { useEffect } from 'react'
import { olaTokenMobile, saveOlaAccessToken } from '../api/olaTokens'
import { peekOlaAuthTestMobile } from '../lib/olaAuthTest'
import { takeOlaOauthPendingSave } from '../lib/olaOauth'
import { getUserContext } from '../lib/userContext'
import { readStoredOlaToken } from '../lib/olaToken'

function resolveOlaTokenMobile(user) {
  return olaTokenMobile(user?.mobile || peekOlaAuthTestMobile())
}

/** PUT /api/ola/tokens/{mobile} with the token just stored from Ola's callback. */
export function persistOlaTokenToBackend() {
  const user = getUserContext() || {}
  const token = readStoredOlaToken(user)
  const mobile = resolveOlaTokenMobile(user)
  if (!token || !mobile) return
  if (!takeOlaOauthPendingSave()) return

  saveOlaAccessToken(mobile, {
    accessToken: token,
    expiresIn: user.olaExpiresIn,
  }).catch((error) => {
    if (error?.name === 'AbortError') return
  })
}

/** After Ola redirects back with #access_token, PUT it to /api/ola/tokens/{mobile}. */
export function useSaveOlaTokenOnCallback() {
  useEffect(() => {
    persistOlaTokenToBackend()
  }, [])
}
