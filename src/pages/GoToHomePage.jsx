import { GOTO_HOME_PATH } from '../lib/appContext'

/**
 * Empty exit page for the native WebView.
 * Host app should intercept this URL and close the WebView / show native home.
 */
export function GoToHomePage() {
  return (
    <main
      data-mt-exit="gotohome"
      data-path={GOTO_HOME_PATH}
      style={{
        margin: 0,
        minHeight: '100%',
        background: '#ffffff',
      }}
      aria-hidden="true"
    />
  )
}
