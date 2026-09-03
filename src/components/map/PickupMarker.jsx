import { DistanceBadge } from './DistanceBadge'
import { LocationLabel } from './LocationLabel'

export function PickupMarker({ vehicleSrc, placeName, distanceValue, distanceUnit = 'KM' }) {
  return (
    <div className="mt-map-pickup">
      <div className="mt-map-pickup__vehicle">
        <img src={vehicleSrc} alt="" width={52} height={36} draggable={false} />
        <span className="mt-map-pickup__dot" aria-hidden="true" />
      </div>
      <div className="mt-map-pickup__cluster">
        <DistanceBadge value={distanceValue} unit={distanceUnit} />
        <LocationLabel name={placeName} />
      </div>
    </div>
  )
}
