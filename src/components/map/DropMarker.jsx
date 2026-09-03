import { LocationLabel } from './LocationLabel'

export function DropMarker({ placeName }) {
  return (
    <div className="mt-map-drop">
      <div className="mt-map-drop__label">
        <LocationLabel name={placeName} />
      </div>
      <span className="mt-map-drop__pin" aria-hidden="true">
        <span className="mt-map-drop__pin-inner" />
      </span>
    </div>
  )
}
