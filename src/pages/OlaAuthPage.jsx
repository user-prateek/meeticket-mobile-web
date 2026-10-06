import { getUserContext } from '../lib/userContext'
import {
  OLA_AUTH_TEST_AUTHORIZE_URL,
  OLA_AUTH_TEST_RETURN_URL,
  saveOlaAuthTestReturn,
} from '../lib/olaAuthTest'

export function OlaAuthPage() {
  function startOlaAuthTest() {
    saveOlaAuthTestReturn(OLA_AUTH_TEST_RETURN_URL, getUserContext()?.mobile)
    window.location.assign(OLA_AUTH_TEST_AUTHORIZE_URL)
  }

  return (
    <main
      style={{
        minHeight: '100dvh',
        margin: 0,
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <button
        type="button"
        onClick={startOlaAuthTest}
        style={{
          fontSize: 16,
          fontWeight: 600,
          padding: '12px 20px',
          borderRadius: 8,
          border: '1px solid #111',
          background: '#111',
          color: '#fff',
        }}
      >
        Login with Ola
      </button>
    </main>
  )
}
