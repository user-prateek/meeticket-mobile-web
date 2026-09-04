/**
 * Top-down bike for live map — faces "north" (up) so CSS rotate(bearing) matches heading.
 */
export function TrackingBikeMarker({ size = 48, bearing = 0, className }) {
  return (
    <div
      className={`mt-track-vehicle ${className || ''}`.trim()}
      style={{ transform: `translate(-50%, -50%) rotate(${bearing}deg)` }}
    >
      <span className="mt-track-vehicle__glow" aria-hidden="true" />
      <svg
        className="mt-track-vehicle__icon"
        width={size}
        height={size}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <ellipse cx="32" cy="48" rx="10" ry="6" fill="#111" opacity="0.2" />
        {/* rear wheel */}
        <circle cx="32" cy="46" r="7" fill="#1a1a1a" stroke="#333" strokeWidth="1.5" />
        <circle cx="32" cy="46" r="3" fill="#666" />
        {/* body */}
        <rect x="27" y="18" width="10" height="26" rx="4" fill="#1f1f1f" />
        <rect x="24" y="28" width="16" height="8" rx="2" fill="#2b2b2b" />
        {/* rider */}
        <circle cx="32" cy="16" r="6" fill="#3d2b1f" />
        <path d="M26 22c2-4 10-4 12 0v8H26V22Z" fill="#1a73e8" />
        {/* front wheel / handlebar tip */}
        <circle cx="32" cy="12" r="4.5" fill="#111" stroke="#444" strokeWidth="1.2" />
        <rect x="29" y="8" width="6" height="3" rx="1" fill="#222" />
      </svg>
    </div>
  )
}
