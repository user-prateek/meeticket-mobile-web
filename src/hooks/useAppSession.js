import { useAtomValue } from 'jotai'
import { getAppContext } from '../lib/appContext'
import { getUserContext } from '../lib/userContext'
import { appContextAtom, userAtom } from '../store/journey'

/**
 * WebView session: platform/app version + user credentials from entry URL.
 * Values are captured once from query params into session storage / Jotai,
 * then stripped from the address bar on navigation.
 */
export function useAppSession() {
  const user = useAtomValue(userAtom)
  const appContext = useAtomValue(appContextAtom)

  return {
    user: user || getUserContext(),
    appContext: appContext?.src || appContext?.versionName ? appContext : getAppContext(),
  }
}
