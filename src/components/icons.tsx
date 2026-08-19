import type { CSSProperties, ReactNode } from 'react'
import type { TransportMode } from '../types/route'

type IconProps = {
  size?: number
  className?: string
}

export function BackIcon({ size = 22, className }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15.5 5.5 8.5 12l7 6.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function MetroIcon({ size = 18, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="4" width="16" height="13" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 17.5 6.5 20.5M16 17.5l1.5 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="8.5" cy="11" r="1.2" fill="currentColor" />
      <circle cx="15.5" cy="11" r="1.2" fill="currentColor" />
      <path d="M4 8h16" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  )
}

export function BusIcon({ size = 18, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="3.5" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M4 10h16" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="8" cy="19" r="1.6" fill="currentColor" />
      <circle cx="16" cy="19" r="1.6" fill="currentColor" />
      <path d="M7 6.5h3M14 6.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export function WalkIcon({ size = 18, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="13" cy="5" r="2" fill="currentColor" />
      <path
        d="M10 10.5 12.2 9l2.2 3.2 2.4 1.4M9 21l2.2-6.2L15 16.5l2 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.2 9 9.2 12.5 7 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function CabIcon({ size = 16, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 16V11.2L7.4 7h9.2L19 11.2V16" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M4 16h16v2.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V16Z" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="7.5" cy="16" r="1.2" fill="currentColor" />
      <circle cx="16.5" cy="16" r="1.2" fill="currentColor" />
      <path d="M10 7V5.5h4V7" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

export function AutoIcon({ size = 16, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 16.5 7 8h8l5 5.5v3" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M4 16.5h16" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="8" cy="18" r="1.6" fill="currentColor" />
      <circle cx="16.5" cy="18" r="1.6" fill="currentColor" />
      <path d="M10 8v5.5h7" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

export function BikeIcon({ size = 16, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="6.5" cy="16.5" r="3" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="17.5" cy="16.5" r="3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M6.5 16.5 10 9h5l2.5 7.5M10 9 12.5 16.5M13 7h4" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  )
}

const MODE_ICONS: Record<TransportMode, (props: IconProps) => ReactNode> = {
  metro: MetroIcon,
  bus: BusIcon,
  walk: WalkIcon,
  cab: CabIcon,
  auto: AutoIcon,
  bike: BikeIcon,
}

export function PhoneIcon({ size = 22, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7.2 3.8h3.2l1.2 3.2-1.8 1.2a12.5 12.5 0 0 0 6 6l1.2-1.8 3.2 1.2v3.2c0 .9-.7 1.7-1.6 1.8C9.8 19.4 4.6 14.2 3.4 5.4c-.1-.9.7-1.6 1.6-1.6Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CashIcon({ size = 22, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="6" fill="#0fa146" />
      <rect x="5" y="8" width="14" height="8" rx="1.4" fill="none" stroke="#fff" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.5" fill="#fff" />
    </svg>
  )
}

export function AppLogo({ size = 36, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="18" fill="#060496" />
      <circle cx="14" cy="16" r="7" fill="#0fa146" />
      <circle cx="22" cy="16" r="7" fill="#3d5bff" />
      <path d="M18 11.5v14" stroke="#fff" strokeWidth="1.6" />
    </svg>
  )
}

export function ClockIcon({ size = 16, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4.2l2.8 1.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevronIcon({ size = 16, className }: IconProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 5.5 16 12l-7 6.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function ModeIcon({
  mode,
  size,
  className,
  style,
}: IconProps & { mode: TransportMode; style?: CSSProperties }) {
  const Icon = MODE_ICONS[mode]
  return (
    <span className={className} style={style}>
      <Icon size={size} />
    </span>
  )
}
