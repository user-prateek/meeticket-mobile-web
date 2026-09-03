/**
 * Shared skeleton primitives for journey / bookings loading states.
 * Visual language matches the HTML boot shell in index.html.
 */
import './PageSkeleton.css'

function Bone({ className = '', style }) {
  return <span className={`mt-skel-bone ${className}`.trim()} style={style} aria-hidden="true" />
}

function RouteCardSkeleton() {
  return (
    <div className="mt-skel-card" aria-hidden="true">
      <div className="mt-skel-card__row">
        <Bone className="mt-skel-bone--pill" />
        <Bone className="mt-skel-bone--pill mt-skel-bone--short" />
      </div>
      <div className="mt-skel-card__stops">
        <Bone className="mt-skel-bone--line" />
        <Bone className="mt-skel-bone--line mt-skel-bone--mid" />
      </div>
      <div className="mt-skel-card__modes">
        <Bone className="mt-skel-bone--chip" />
        <Bone className="mt-skel-bone--chip" />
        <Bone className="mt-skel-bone--chip" />
      </div>
      <div className="mt-skel-card__metrics">
        <Bone className="mt-skel-bone--metric" />
        <Bone className="mt-skel-bone--metric" />
        <Bone className="mt-skel-bone--metric" />
      </div>
    </div>
  )
}

export function JourneyListCardSkeletons({ count = 2 }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <RouteCardSkeleton key={index} />
      ))}
    </>
  )
}

export function JourneySkeleton({ subtitle }) {
  return (
    <section className="mt-srp mt-skel" aria-busy="true" aria-label="Loading journey options">
      <header className="mt-skel-header">
        <Bone className="mt-skel-bone--back" />
        <div className="mt-skel-header__copy">
          <strong className="mt-skel-header__title">Journey Options</strong>
          {subtitle ? <p className="mt-skel-header__sub">{subtitle}</p> : <Bone className="mt-skel-bone--sub" />}
        </div>
      </header>

      <div className="mt-skel-sort" aria-hidden="true">
        <Bone className="mt-skel-bone--sort-label" />
        <Bone className="mt-skel-bone--chip" />
        <Bone className="mt-skel-bone--chip" />
        <Bone className="mt-skel-bone--chip" />
      </div>

      <div className="mt-srp__list mt-skel-list">
        <RouteCardSkeleton />
        <RouteCardSkeleton />
        <RouteCardSkeleton />
      </div>

      <div className="mt-srp__footer" aria-hidden="true">
        <Bone className="mt-skel-bone--cta" />
      </div>
    </section>
  )
}

export function BookingsSkeleton() {
  return (
    <div className="mt-bookings mt-skel" aria-busy="true" aria-label="Loading bookings">
      <header className="mt-skel-header">
        <Bone className="mt-skel-bone--back" />
        <div className="mt-skel-header__copy">
          <strong className="mt-skel-header__title">Multi Model Bookings</strong>
        </div>
      </header>

      <div className="mt-bookings__body mt-skel-list">
        <RouteCardSkeleton />
        <RouteCardSkeleton />
      </div>
    </div>
  )
}
