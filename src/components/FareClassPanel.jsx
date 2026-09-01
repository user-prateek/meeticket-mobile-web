/** Bus fare-tier picker — shared by SRP RouteCard and Journey Detail. */
export function FareClassPanel({
  segmentId,
  options = [],
  selectedId,
  onSelect,
  side = 'end',
  ariaLabel = 'Bus fare classes',
  className = '',
  onClick,
}) {
  if (!options.length) return null

  return (
    <div
      className={`mt-fare-classes is-bus is-side-${side}${className ? ` ${className}` : ''}`}
      role="radiogroup"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {options.map((option) => {
        const active = selectedId === option.id
        return (
          <label
            key={option.id}
            className={`mt-fare-classes__row${active ? ' is-selected' : ''}`}
          >
            <input
              type="radio"
              name={`fare-${segmentId}`}
              checked={active}
              onChange={() => onSelect?.(option.id)}
            />
            <span className="mt-fare-classes__label">{option.label}</span>
            <span className="mt-fare-classes__fare">₹{option.fareInr}</span>
          </label>
        )
      })}
    </div>
  )
}
