import { ChevronIcon } from '../icons'

export function LocationLabel({ name }) {
  return (
    <div className="mt-map-label">
      <span className="mt-map-label__name">{name}</span>
      <ChevronIcon size={11} className="mt-map-label__chevron" />
    </div>
  )
}
