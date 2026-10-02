import { openGoogleDirections } from '../lib/mapGuide'

const FROM = { lat: 17.440269, lng: 78.442599, label: 'SR NAGAR' }
const TO = { lat: 17.34654207243523, lng: 78.55145887707285, label: 'LB NAGAR' }

export function MapOpenPage() {
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
        onClick={() => openGoogleDirections(FROM, TO, 'driving')}
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
        Open map
      </button>
    </main>
  )
}
