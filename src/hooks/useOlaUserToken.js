import { useEffect } from 'react'
import { useSetAtom } from 'jotai'
import { olaTokenMobile, saveOlaAccessToken } from '../api/olaTokens'
import { takeOlaOauthPendingSave } from '../lib/olaOauth'
import { getUserContext } from '../lib/userContext'
import { readStoredOlaToken } from '../lib/olaToken'
import { userAtom } from '../store/journey'

/** After Ola redirects back with #access_token, PUT it to /api/ola/tokens/{mobile}. */
export function useSaveOlaTokenOnCallback() {
  const setUser = useSetAtom(userAtom)

  useEffect(() => {
    if (!takeOlaOauthPendingSave()) return undefined

    const user = getUserContext() || {}
    const token = readStoredOlaToken(user)
    const mobile = olaTokenMobile(user.mobile)
    if (!token || !mobile) return undefined

    const controller = new AbortController()
    saveOlaAccessToken(
      mobile,
      {
        accessToken: token,
        expiresIn: user.olaExpiresIn,
      },
      { signal: controller.signal },
    )
      .then(() => setUser(getUserContext()))
      .catch((error) => {
        if (error?.name === 'AbortError') return
      })

    return () => controller.abort()
  }, [setUser])
}
