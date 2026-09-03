export function DistanceBadge({ value, unit = 'KM' }) {
  return (
    <div className="mt-map-badge">
      <span className="mt-map-badge__value">{value}</span>
      <span className="mt-map-badge__unit">{unit}</span>
    </div>
  )
}
