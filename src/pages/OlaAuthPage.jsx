import { getUserContext } from '../lib/userContext'
import { startOlaAuthTest } from '../lib/olaAuthTest'

export function OlaAuthPage() {
  function onLogin() {
    startOlaAuthTest(getUserContext()?.mobile)
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
        onClick={onLogin}
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
