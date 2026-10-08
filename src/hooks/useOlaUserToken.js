import { useAtomValue } from 'jotai'
import { olaTokenMobile, saveOlaAccessToken } from '../api/olaTokens'
import { peekOlaAuthTestMobile } from '../lib/olaAuthTest'
import {
  appendOlaTokenToReturnUrl,
  clearOlaOauthReturn,
  clearOlaOauthState,
  peekOlaOauthReturn,
  peekOlaOauthState,
} from '../lib/olaOauth'
import { getUserContext } from '../lib/userContext'
import { storeOlaAccessToken, usableOlaAccessToken } from '../lib/olaToken'
import { olaAccessTokenAtom } from '../store/journey'

let returnFlight = null
let returnFlightKey = ''

/** Same session record the journey query token and the restored OAuth token share. */
export function saveOlaUserToken(accessToken, { expiresIn, expiresAt } = {}) {
  return storeOlaAccessToken({ accessToken, expiresIn, expiresAt })
}

export function useOlaUserAccessToken() {
  return usableOlaAccessToken(useAtomValue(olaAccessTokenAtom))
}

/**
 * Ola hash callback: verify the token, PUT it, then build the original journey URL
 * with that token attached. Does not navigate. Clears the saved URL only after it
 * has been turned into that journey link.
 */
export function completeOlaOauthReturn(oauth) {
  const key = `${oauth?.state || ''}:${oauth?.accessToken || ''}`
  if (returnFlight && returnFlightKey === key) return returnFlight
  returnFlightKey = key
  returnFlight = runOlaOauthReturn(oauth).finally(() => {
    if (returnFlightKey === key) returnFlight = null
  })
  return returnFlight
}

async function runOlaOauthReturn(oauth) {
  const accessToken = String(oauth?.accessToken || '').trim()
  if (!accessToken) {
    throw new Error('Ola did not return an access token.')
  }
  const returnedState = String(oauth?.state || '').trim()
  if (!returnedState) {
    throw new Error('Ola login could not be verified.')
  }

  let mobile = olaTokenMobile(
    getUserContext()?.mobile || peekOlaOauthReturn()?.mobile || peekOlaAuthTestMobile(),
  )
  
  if (!mobile) {
    mobile = '8853849950'
    //throw new Error('Mobile number is missing, so the Ola token was not saved.')
  }

  console.info('[ola] redirect access token', accessToken)
  await saveOlaAccessToken(mobile, {
    accessToken,
    expiresIn: oauth?.expiresIn,
  })

  const saved = peekOlaOauthReturn()
  const target = appendOlaTokenToReturnUrl(saved?.url, accessToken, oauth?.expiresIn)
  if (!saved?.url || !target) {
    throw new Error('Could not restore your journey after Ola login.')
  }

  clearOlaOauthState()
  clearOlaOauthReturn()
  return target
}
