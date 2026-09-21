import './InlineSpinner.css'

export function isLiveSlotLoading(status) {
  return status === 'loading'
}

export function InlineSpinner({ size = 28, label = 'Loading' }) {
  return (
    <div className="mt-inline-spinner" role="status" aria-label={label}>
      <span
        className="mt-inline-spinner__circle"
        style={{ width: size, height: size }}
        aria-hidden="true"
      />
    </div>
  )
}
